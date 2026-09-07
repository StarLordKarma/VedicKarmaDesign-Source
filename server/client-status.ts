import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  bookingRequests,
  clientAccessTokens,
  reportAuditEvents,
  reportJobs,
  reportVersions,
} from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl } from "./storage";

const TOKEN_BYTES = 32;
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 720;

export type ClientStatusState =
  | "waiting_payment"
  | "preparing"
  | "ready_for_review"
  | "sent"
  | "failed"
  | "cancelled";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidClientAccessToken(token: string) {
  return /^[A-Za-z0-9_-]{32,100}$/.test(token.trim());
}

async function findActiveAccess(rawToken: string) {
  const normalized = rawToken.trim();
  if (!isValidClientAccessToken(normalized))
    return { kind: "not_found" as const };
  const db = await getDb();
  if (!db) return { kind: "unavailable" as const };
  const tokenHash = hashToken(normalized);
  const access = (
    await db
      .select()
      .from(clientAccessTokens)
      .where(eq(clientAccessTokens.tokenHash, tokenHash))
      .limit(1)
  )[0];
  if (!access) return { kind: "not_found" as const };
  if (access.revokedAt)
    return {
      kind: "revoked" as const,
      expiresAt: access.expiresAt.toISOString(),
    };
  if (access.expiresAt.getTime() <= Date.now())
    return {
      kind: "expired" as const,
      expiresAt: access.expiresAt.toISOString(),
    };
  return { kind: "active" as const, db, access, tokenHash, normalized };
}

function publicReference(tokenHash: string) {
  return `JR-${tokenHash.slice(0, 10).toUpperCase()}`;
}

function toPreparationState(
  status: string | null | undefined
): ClientStatusState {
  if (status === "cancelled" || status === "rejected") return "cancelled";
  if (status === "sent") return "sent";
  if (status === "approved") return "ready_for_review";
  if (
    status === "delivery_failed" ||
    status === "calculation_failed" ||
    status === "render_failed"
  )
    return "failed";
  if (status === "waiting_payment") return "waiting_payment";
  return "preparing";
}

export function normalizeExpiryHours(hours: number) {
  if (
    !Number.isInteger(hours) ||
    hours < MIN_EXPIRY_HOURS ||
    hours > MAX_EXPIRY_HOURS
  ) {
    throw new Error(
      `Expiry must be an integer between ${MIN_EXPIRY_HOURS} and ${MAX_EXPIRY_HOURS} hours.`
    );
  }
  return hours;
}

export async function createClientStatusLink(input: {
  bookingId: number;
  expiryHours: number;
  createdBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const booking = (
    await db
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, input.bookingId))
      .limit(1)
  )[0];
  if (!booking) throw new Error("Booking request not found.");
  const expiryHours = normalizeExpiryHours(input.expiryHours);
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  await db
    .insert(clientAccessTokens)
    .values({
      bookingId: input.bookingId,
      tokenHash,
      expiresAt,
      createdBy: input.createdBy,
    });
  return { token, tokenHash, expiresAt, reference: publicReference(tokenHash) };
}

export async function revokeClientStatusLink(tokenId: number, actorId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const result = await db
    .update(clientAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(clientAccessTokens.id, tokenId),
        isNull(clientAccessTokens.revokedAt)
      )
    );
  void actorId;
  return result;
}

export async function listClientStatusLinks() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: clientAccessTokens.id,
      bookingId: clientAccessTokens.bookingId,
      expiresAt: clientAccessTokens.expiresAt,
      revokedAt: clientAccessTokens.revokedAt,
      lastAccessedAt: clientAccessTokens.lastAccessedAt,
      createdAt: clientAccessTokens.createdAt,
      createdBy: clientAccessTokens.createdBy,
    })
    .from(clientAccessTokens)
    .orderBy(desc(clientAccessTokens.createdAt))
    .limit(200);
}

export async function getPublicClientStatus(rawToken: string) {
  const resolved = await findActiveAccess(rawToken);
  if (resolved.kind !== "active") return resolved;
  const { db, access, tokenHash, normalized } = resolved;
  await db
    .update(clientAccessTokens)
    .set({ lastAccessedAt: new Date() })
    .where(eq(clientAccessTokens.id, access.id));
  const booking = (
    await db
      .select({
        paymentStatus: bookingRequests.paymentStatus,
        status: bookingRequests.status,
        deliveryStatus: bookingRequests.deliveryStatus,
        createdAt: bookingRequests.createdAt,
        statusUpdatedAt: bookingRequests.statusUpdatedAt,
      })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, access.bookingId))
      .limit(1)
  )[0];
  if (!booking) return { kind: "not_found" as const };
  const job = (
    await db
      .select({ status: reportJobs.status, updatedAt: reportJobs.updatedAt })
      .from(reportJobs)
      .where(eq(reportJobs.bookingId, access.bookingId))
      .orderBy(desc(reportJobs.updatedAt))
      .limit(1)
  )[0];
  const jobStatus =
    job?.status ??
    (booking.paymentStatus === "finished" ||
    booking.paymentStatus === "confirmed"
      ? "queued"
      : "waiting_payment");
  return {
    kind: "active" as const,
    reference: publicReference(tokenHash),
    expiresAt: access.expiresAt.toISOString(),
    paymentState:
      booking.paymentStatus === "finished" ||
      booking.paymentStatus === "confirmed"
        ? "paid"
        : booking.paymentStatus === "failed"
          ? "failed"
          : "pending",
    preparationState: toPreparationState(jobStatus),
    deliveryState:
      booking.deliveryStatus === "sent" || jobStatus === "sent"
        ? "sent"
        : booking.deliveryStatus === "failed" || jobStatus === "delivery_failed"
          ? "failed"
          : "pending",
    createdAt: booking.createdAt.toISOString(),
    updatedAt: (
      job?.updatedAt ??
      booking.statusUpdatedAt ??
      booking.createdAt
    ).toISOString(),
    reportDownloadUrl:
      jobStatus === "sent"
        ? `/api/client/report/${encodeURIComponent(normalized)}`
        : null,
  };
}

export async function getClientReportDownload(rawToken: string) {
  const resolved = await findActiveAccess(rawToken);
  if (resolved.kind !== "active") return resolved;
  const { db, access, tokenHash } = resolved;
  const job = (
    await db
      .select({ id: reportJobs.id })
      .from(reportJobs)
      .where(
        and(
          eq(reportJobs.bookingId, access.bookingId),
          eq(reportJobs.status, "sent")
        )
      )
      .orderBy(desc(reportJobs.updatedAt))
      .limit(1)
  )[0];
  if (!job) return { kind: "not_ready" as const };
  const version = (
    await db
      .select({
        id: reportVersions.id,
        pdfStorageKey: reportVersions.pdfStorageKey,
      })
      .from(reportVersions)
      .where(
        and(
          eq(reportVersions.reportJobId, job.id),
          eq(reportVersions.status, "sent")
        )
      )
      .orderBy(desc(reportVersions.versionNumber))
      .limit(1)
  )[0];
  if (!version?.pdfStorageKey) return { kind: "not_ready" as const };
  const url = await storageGetSignedUrl(
    version.pdfStorageKey,
    `vedic-karma-report-${publicReference(tokenHash)}.pdf`
  );
  await db
    .update(clientAccessTokens)
    .set({ lastAccessedAt: new Date() })
    .where(eq(clientAccessTokens.id, access.id));
  await db
    .insert(reportAuditEvents)
    .values({
      reportJobId: job.id,
      eventType: "client_pdf_downloaded",
      actorType: "client",
      actorId: publicReference(tokenHash),
      fromStatus: "sent",
      toStatus: "sent",
      metadataJson: JSON.stringify({ versionId: version.id }),
    });
  return { kind: "ready" as const, url };
}
