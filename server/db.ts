import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertBookingRequest, InsertUser, bookingRequests, users } from "../drizzle/schema";
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

export async function createBookingRequest(input: InsertBookingRequest) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const result = await db.insert(bookingRequests).values(input);
  return { id: Number(result[0].insertId) };
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
  const previousStatus = current[0]?.paymentStatus ?? null;
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

export async function updateBookingDelivery(input: { id: number; deliveryStatus: "sending" | "sent" | "failed"; deliveryError?: string | null; deliveredBy?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(bookingRequests).set({ deliveryStatus: input.deliveryStatus, deliveryError: input.deliveryError ?? null, ...(input.deliveryStatus === "sent" ? { deliveredAt: new Date(), deliveredBy: input.deliveredBy ?? null } : {}) }).where(eq(bookingRequests.id, input.id));
  const result = await db.select().from(bookingRequests).where(eq(bookingRequests.id, input.id)).limit(1);
  if (!result[0]) throw new Error("Booking request not found");
  return result[0];
}

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
