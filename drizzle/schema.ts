import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const bookingRequests = mysqlTable("booking_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  birthDate: varchar("birthDate", { length: 10 }).notNull(),
  birthTime: varchar("birthTime", { length: 5 }).notNull(),
  birthCity: varchar("birthCity", { length: 160 }).notNull(),
  birthCountry: varchar("birthCountry", { length: 160 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  addon: int("addon").default(0).notNull(),
  totalUsd: int("totalUsd").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  interest: text("interest"),
  paymentId: varchar("paymentId", { length: 128 }),
  paymentUrl: text("paymentUrl"),
  paymentStatus: varchar("paymentStatus", { length: 32 }).default("waiting"),
  status: mysqlEnum("status", ["new", "in_progress", "completed", "cancelled"]).default("new").notNull(),
  adminNote: text("adminNote"),
  statusUpdatedAt: timestamp("statusUpdatedAt"),
  statusUpdatedBy: varchar("statusUpdatedBy", { length: 64 }),
  natalPdfKey: varchar("natalPdfKey", { length: 512 }),
  natalPdfUrl: text("natalPdfUrl"),
  natalPdfName: varchar("natalPdfName", { length: 255 }),
  natalPdfUploadedAt: timestamp("natalPdfUploadedAt"),
  natalPdfUploadedBy: varchar("natalPdfUploadedBy", { length: 64 }),
  deliveryStatus: varchar("deliveryStatus", { length: 32 }).default("not_sent").notNull(),
  deliveryError: text("deliveryError"),
  deliveredAt: timestamp("deliveredAt"),
  deliveredBy: varchar("deliveredBy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = typeof bookingRequests.$inferInsert;

export const clientChangeHistory = mysqlTable("client_change_history", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  changedBy: varchar("changedBy", { length: 64 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  changes: text("changes").notNull(),
});

export type ClientChangeHistory = typeof clientChangeHistory.$inferSelect;

export const servicePricing = mysqlTable("service_pricing", {
  id: int("id").primaryKey(),
  basicUsd: int("basicUsd").notNull(),
  numerologyAddonUsd: int("numerologyAddonUsd").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ServicePricing = typeof servicePricing.$inferSelect;
export type InsertServicePricing = typeof servicePricing.$inferInsert;

export const servicePricingCurrencies = mysqlTable("service_pricing_currencies", {
  currency: varchar("currency", { length: 3 }).primaryKey(),
  basicAmount: int("basicAmount").notNull(),
  numerologyAddonAmount: int("numerologyAddonAmount").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 64 }).notNull(),
});

export type ServicePricingCurrency = typeof servicePricingCurrencies.$inferSelect;
export type InsertServicePricingCurrency = typeof servicePricingCurrencies.$inferInsert;

export const servicePricingHistory = mysqlTable("service_pricing_history", {
  id: int("id").autoincrement().primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  oldBasicAmount: int("oldBasicAmount").notNull(),
  oldNumerologyAddonAmount: int("oldNumerologyAddonAmount").notNull(),
  newBasicAmount: int("newBasicAmount").notNull(),
  newNumerologyAddonAmount: int("newNumerologyAddonAmount").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  changedBy: varchar("changedBy", { length: 64 }).notNull(),
});

export type ServicePricingHistory = typeof servicePricingHistory.$inferSelect;
export type InsertServicePricingHistory = typeof servicePricingHistory.$inferInsert;