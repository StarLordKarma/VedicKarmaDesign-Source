import { count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { and, gte, lt } from "drizzle-orm";
import { ClientChangeHistory, InsertBookingRequest, InsertUser, bookingRequests, clientChangeHistory, servicePricing, servicePricingCurrencies, servicePricingHistory, smokeTestRuns, users } from "../drizzle/schema";
import { READING_PRICES } from "@shared/pricing";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type SupportedCurrency = "USD" | "EUR" | "GBP";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["USD", "EUR", "GBP"];
export type ServicePricingConfig = { basicUsd: number; numerologyAddonUsd: number };
export type CurrencyPricingConfig = ServicePricingConfig & { currency: SupportedCurrency; updatedAt?: Date; updatedBy?: string };

function normalizeCurrency(currency?: string): SupportedCurrency { const normalized = (currency ?? "USD").toUpperCase(); return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized as SupportedCurrency : "USD"; }

const defaultPricing = { basicUsd: READING_PRICES.basic, numerologyAddonUsd: READING_PRICES.numerologyAddon } as const;

export async function getServicePricing(currency = "USD"): Promise<ServicePricingConfig> {
  const normalized = normalizeCurrency(currency);
  const db = await getDb();
  if (!db) return defaultPricing;
  const currencyResult = await db.select({ basicUsd: servicePricingCurrencies.basicAmount, numerologyAddonUsd: servicePricingCurrencies.numerologyAddonAmount }).from(servicePricingCurrencies).where(eq(servicePricingCurrencies.currency, normalized)).limit(1);
  if (currencyResult[0]) return currencyResult[0];
  if (normalized === "USD") {
    const legacy = await db.select({ basicUsd: servicePricing.basicUsd, numerologyAddonUsd: servicePricing.numerologyAddonUsd }).from(servicePricing).where(eq(servicePricing.id, 1)).limit(1);
    if (legacy[0]) return legacy[0];
  }
  return defaultPricing;
}

export async function listServicePricing(): Promise<CurrencyPricingConfig[]> {
  const db = await getDb();
  if (!db) return SUPPORTED_CURRENCIES.map((currency) => ({ currency, ...defaultPricing }));
  const rows = await db.select({ currency: servicePricingCurrencies.currency, basicUsd: servicePricingCurrencies.basicAmount, numerologyAddonUsd: servicePricingCurrencies.numerologyAddonAmount, updatedAt: servicePricingCurrencies.updatedAt, updatedBy: servicePricingCurrencies.updatedBy }).from(servicePricingCurrencies);
  return SUPPORTED_CURRENCIES.map((currency) => { const match = rows.find((row) => row.currency === currency); return match ? { ...match, currency } : { currency, ...defaultPricing }; });
}

type PricingHistoryFilters = { currency?: "USD" | "EUR" | "GBP"; from?: string; to?: string };

function pricingHistoryConditions(filters?: PricingHistoryFilters) {
  const conditions = [];
  if (filters?.currency) conditions.push(eq(servicePricingHistory.currency, filters.currency));
  if (filters?.from) conditions.push(gte(servicePricingHistory.changedAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters?.to) {
    const endExclusive = new Date(`${filters.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    conditions.push(lt(servicePricingHistory.changedAt, endExclusive));
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function getPricingHistoryPage(page = 1, pageSize = 10, filters?: PricingHistoryFilters) {
  const db = await getDb();
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  if (!db) return { items: [], total: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };
  const where = pricingHistoryConditions(filters);
  const [{ total }] = await db.select({ total: count() }).from(servicePricingHistory).where(where);
  const items = await db.select().from(servicePricingHistory).where(where).orderBy(desc(servicePricingHistory.changedAt)).limit(safePageSize).offset((safePage - 1) * safePageSize);
  return { items, total, page: safePage, pageSize: safePageSize, totalPages: Math.ceil(total / safePageSize) };
}

export async function getPricingHistory(limit = 50, filters?: PricingHistoryFilters) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(servicePricingHistory).where(pricingHistoryConditions(filters)).orderBy(desc(servicePricingHistory.changedAt)).limit(limit);
}

export async function createSmokeTestRun(runId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(smokeTestRuns).values({ runId, status: "running" });
  return { id: Number(result[0].insertId), runId };
}

export async function updateSmokeTestRunProgress(runId: string, result: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(smokeTestRuns).set({ result }).where(eq(smokeTestRuns.runId, runId));
}

export async function finishSmokeTestRun(input: { runId: string; status: "succeeded" | "failed"; result: string; durationMs: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(smokeTestRuns).set({ status: input.status, result: input.result, finishedAt: new Date(), durationMs: input.durationMs }).where(eq(smokeTestRuns.runId, input.runId));
}

export async function getSmokeTestRuns(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smokeTestRuns).orderBy(desc(smokeTestRuns.startedAt)).limit(Math.min(100, Math.max(1, Math.floor(limit))));
}

export async function updateServicePricing(input: ServicePricingConfig & { currency?: string; updatedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const currency = normalizeCurrency(input.currency);
  const previous = await getServicePricing(currency);
  await db.insert(servicePricingCurrencies).values({ currency, basicAmount: input.basicUsd, numerologyAddonAmount: input.numerologyAddonUsd, updatedBy: input.updatedBy }).onDuplicateKeyUpdate({ set: { basicAmount: input.basicUsd, numerologyAddonAmount: input.numerologyAddonUsd, updatedBy: input.updatedBy, updatedAt: new Date() } });
  if (previous.basicUsd !== input.basicUsd || previous.numerologyAddonUsd !== input.numerologyAddonUsd) {
    await db.insert(servicePricingHistory).values({ currency, oldBasicAmount: previous.basicUsd, oldNumerologyAddonAmount: previous.numerologyAddonUsd, newBasicAmount: input.basicUsd, newNumerologyAddonAmount: input.numerologyAddonUsd, changedBy: input.updatedBy });
  }
  return { basicUsd: input.basicUsd, numerologyAddonUsd: input.numerologyAddonUsd };
}

export async function createBookingRequest(input: InsertBookingRequest) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const result = await db.insert(bookingRequests).values(input);
  return { id: Number(result[0].insertId) };
}

export async function deleteBookingRequest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(bookingRequests).where(eq(bookingRequests.id, id));
}

export async function updateBookingPayment(input: {
  id: number;
  paymentId?: string;
  paymentUrl?: string;
  paymentStatus: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.update(bookingRequests).set({
    paymentId: input.paymentId,
    paymentUrl: input.paymentUrl,
    paymentStatus: input.paymentStatus,
  }).where(eq(bookingRequests.id, input.id));
}

export async function updateBookingPaymentStatus(input: {
  id: number;
  paymentId?: string;
  paymentStatus: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const current = await db.select({ paymentStatus: bookingRequests.paymentStatus })
    .from(bookingRequests)
    .where(eq(bookingRequests.id, input.id))
    .limit(1);
  if (!current[0]) return { previousStatus: null, isConfirmed: false, missing: true };
  const previousStatus = current[0].paymentStatus;
  const isConfirmed = ["finished", "confirmed", "partially_paid"].includes(input.paymentStatus);
  await db.update(bookingRequests).set({
    ...(input.paymentId ? { paymentId: input.paymentId } : {}),
    paymentStatus: input.paymentStatus,
    ...(isConfirmed ? { status: "in_progress" as const } : {}),
  }).where(eq(bookingRequests.id, input.id));
  return { previousStatus, isConfirmed };
}

export async function getBookingRequestById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  return result[0];
}

export async function getAllBookingRequests() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  return db.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
}

export async function attachNatalPdf(input: { id: number; key: string; url: string; name: string; uploadedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(bookingRequests).set({
    natalPdfKey: input.key,
    natalPdfUrl: input.url,
    natalPdfName: input.name,
    natalPdfUploadedAt: new Date(),
    natalPdfUploadedBy: input.uploadedBy,
  }).where(eq(bookingRequests.id, input.id));
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, input.id)).limit(1);
  if (!result[0]) throw new Error("Booking request not found");
  return result[0];
}

export async function updateBookingClient(input: { id: number; changedBy: string; name?: string; email?: string; birthDate?: string; birthTime?: string; birthCity?: string; birthCountry?: string; language?: string; interest?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const { id, changedBy, ...fields } = input;
  const current = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  if (!current[0]) throw new Error("Booking request not found");
  const changedFields = Object.entries(fields).reduce<Record<string, { from: unknown; to: unknown }>>((accumulator, [key, value]) => {
    if (value !== undefined && current[0][key as keyof typeof current[0]] !== value) accumulator[key] = { from: current[0][key as keyof typeof current[0]], to: value };
    return accumulator;
  }, {});
  if (Object.keys(changedFields).length > 0) {
    await db.update(bookingRequests).set(fields).where(eq(bookingRequests.id, id));
    await db.insert(clientChangeHistory).values({ bookingId: id, changedBy, changes: JSON.stringify(changedFields) });
  }
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  return { booking: result[0], changed: Object.keys(changedFields).length > 0 };
}

export async function getClientChangeHistory(bookingId: number): Promise<ClientChangeHistory[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(clientChangeHistory).where(eq(clientChangeHistory.bookingId, bookingId)).orderBy(desc(clientChangeHistory.changedAt));
}

export async function updateBookingDelivery(input: { id: number; deliveryStatus: "sending" | "sent" | "failed"; deliveryError?: string | null; deliveredBy?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(bookingRequests).set({ deliveryStatus: input.deliveryStatus, deliveryError: input.deliveryError ?? null, ...(input.deliveryStatus === "sent" ? { deliveredAt: new Date(), deliveredBy: input.deliveredBy ?? null } : {}) }).where(eq(bookingRequests.id, input.id));
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, input.id)).limit(1);
  if (!result[0]) throw new Error("Booking request not found");
  return result[0];
}

export type AdminActivityFilters = { from?: string; to?: string };
export type AdminActivitySummary = {
  deliveryFailureCount: number;
  pendingPaymentCount: number;
  recentlyEditedClientCount: number;
  deliveryFailures: Array<{ id: number; name: string; email: string; deliveryError: string | null; createdAt: Date }>;
  pendingPayments: Array<{ id: number; name: string; email: string; totalUsd: number; paymentStatus: string | null; createdAt: Date }>;
  recentlyEditedClients: Array<{ id: number; bookingId: number; name: string; email: string; changedBy: string; changedAt: Date; changes: string }>;
};
export type AdminActivityEvents = Pick<AdminActivitySummary, "deliveryFailures" | "pendingPayments" | "recentlyEditedClients">;

function isWithinActivityRange(value: Date, filters: AdminActivityFilters) {
  const timestamp = value.getTime();
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  return timestamp >= from && timestamp <= to;
}

async function getAdminActivityEvents(filters: AdminActivityFilters = {}): Promise<AdminActivityEvents> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const bookings = await db.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
  const allHistories = await db.select().from(clientChangeHistory).orderBy(desc(clientChangeHistory.changedAt));
  const failedBookings = bookings.filter((booking) => booking.deliveryStatus === "failed" && isWithinActivityRange(booking.createdAt, filters));
  const pendingBookings = bookings.filter((booking) => ["waiting", "creating"].includes(booking.paymentStatus ?? "") && isWithinActivityRange(booking.createdAt, filters));
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  return {
    deliveryFailures: failedBookings.map((booking) => ({ id: booking.id, name: booking.name, email: booking.email, deliveryError: booking.deliveryError, createdAt: booking.createdAt })),
    pendingPayments: pendingBookings.map((booking) => ({ id: booking.id, name: booking.name, email: booking.email, totalUsd: booking.totalUsd, paymentStatus: booking.paymentStatus, createdAt: booking.createdAt })),
    recentlyEditedClients: allHistories.filter((history) => isWithinActivityRange(history.changedAt, filters)).map((history) => { const booking = bookingById.get(history.bookingId); return { id: history.id, bookingId: history.bookingId, name: booking?.name ?? `Booking #${history.bookingId}`, email: booking?.email ?? "", changedBy: history.changedBy, changedAt: history.changedAt, changes: history.changes }; }),
  };
}

export async function getAdminActivitySummary(filters: AdminActivityFilters = {}): Promise<AdminActivitySummary> {
  const events = await getAdminActivityEvents(filters);
  return {
    deliveryFailureCount: events.deliveryFailures.length,
    pendingPaymentCount: events.pendingPayments.length,
    recentlyEditedClientCount: events.recentlyEditedClients.length,
    deliveryFailures: events.deliveryFailures.slice(0, 8),
    pendingPayments: events.pendingPayments.slice(0, 8),
    recentlyEditedClients: events.recentlyEditedClients.slice(0, 8),
  };
}

export { getAdminActivityEvents };

export async function updateBookingAdmin(input: { id: number; status?: "new" | "in_progress" | "completed" | "cancelled"; adminNote?: string | null; statusUpdatedBy?: string }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  await db.update(bookingRequests).set({
    ...(input.status ? { status: input.status, statusUpdatedAt: new Date(), statusUpdatedBy: input.statusUpdatedBy ?? null } : {}),
    ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
  }).where(eq(bookingRequests.id, input.id));
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, input.id)).limit(1);
  if (!result[0]) throw new Error("Booking request not found");
  return result[0];
}
