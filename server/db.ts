import { drizzle } from "drizzle-orm/mysql2";
import { and, asc, count, desc, eq, gte, gt, like, lt, sql } from "drizzle-orm";
import { ClientChangeHistory, InsertBookingRequest, InsertUser, bookingRequests, clientChangeHistory, servicePackages, servicePricing, servicePricingCurrencies, servicePricingHistory, smokeTestRuns, users, receiptFiles, receiptRetentionSettings, receiptEmailAttempts, receiptEmailFailureAlerts, slaEmailAllowlist } from "../drizzle/schema";
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

export async function checkDatabaseReadiness(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.warn("[Database] Readiness probe failed");
    return false;
  }
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

export const RECEIPT_RETENTION_OPTIONS = [24, 48, 72] as const;
export type ReceiptRetentionHours = (typeof RECEIPT_RETENTION_OPTIONS)[number];
export const DEFAULT_RECEIPT_RETENTION_HOURS: ReceiptRetentionHours = 48;
export function isReceiptRetentionHours(value: number): value is ReceiptRetentionHours { return RECEIPT_RETENTION_OPTIONS.includes(value as ReceiptRetentionHours); }

export async function getReceiptRetentionHours(): Promise<ReceiptRetentionHours> {
  const db = await getDb();
  if (!db) return DEFAULT_RECEIPT_RETENTION_HOURS;
  const rows = await db.select({ retentionHours: receiptRetentionSettings.retentionHours }).from(receiptRetentionSettings).where(eq(receiptRetentionSettings.id, 1)).limit(1);
  const value = rows[0]?.retentionHours;
  return typeof value === "number" && isReceiptRetentionHours(value) ? value : DEFAULT_RECEIPT_RETENTION_HOURS;
}

export async function updateReceiptRetentionHours(retentionHours: number, updatedBy: string) {
  if (!isReceiptRetentionHours(retentionHours)) throw new Error("Receipt retention must be 24, 48, or 72 hours.");
  const db = await getDb();
  if (db) await db.insert(receiptRetentionSettings).values({ id: 1, retentionHours, updatedBy }).onDuplicateKeyUpdate({ set: { retentionHours, updatedBy, updatedAt: new Date() } });
  return { retentionHours: retentionHours as ReceiptRetentionHours, updatedBy };
}

export async function registerReceiptFile(storageKey: string, createdAt = new Date()) {
  const retentionHours = await getReceiptRetentionHours();
  const expiresAt = new Date(createdAt.getTime() + retentionHours * 60 * 60 * 1000);
  const db = await getDb();
  if (db) await db.insert(receiptFiles).values({ storageKey, createdAt, expiresAt });
  return { storageKey, expiresAt, retentionHours };
}

export async function isReceiptFileActive(storageKey: string, now = new Date()) {
  const db = await getDb();
  if (!db) return true;
  const rows = await db.select({ id: receiptFiles.id }).from(receiptFiles).where(and(eq(receiptFiles.storageKey, storageKey), gt(receiptFiles.expiresAt, now))).limit(1);
  return rows.length > 0;
}

export async function cleanupExpiredReceiptFiles(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const expired = await db.select({ id: receiptFiles.id }).from(receiptFiles).where(lt(receiptFiles.expiresAt, now));
  if (expired.length > 0) await db.delete(receiptFiles).where(lt(receiptFiles.expiresAt, now));
  return expired.length;
}

export const RECEIPT_EMAIL_COOLDOWN_MS = 60_000;
export const RECEIPT_EMAIL_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const RECEIPT_EMAIL_FAILURE_THRESHOLD = 3;
export function normalizeReceiptEmail(email: string) { return email.trim().toLowerCase(); }

export async function listSlaEmailAllowlist() { const db = await getDb(); if (!db) return []; return db.select().from(slaEmailAllowlist).orderBy(asc(slaEmailAllowlist.email)); }
export async function addSlaEmailAllowlist(input: { email: string; label?: string | null; actor: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const email = normalizeReceiptEmail(input.email); await db.insert(slaEmailAllowlist).values({ email, label: input.label?.trim() || null, enabled: true, createdBy: input.actor, updatedBy: input.actor }); return (await db.select().from(slaEmailAllowlist).where(eq(slaEmailAllowlist.email, email)).limit(1))[0]; }
export async function setSlaEmailAllowlistEnabled(input: { id: number; enabled: boolean; actor: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(slaEmailAllowlist).set({ enabled: input.enabled, updatedBy: input.actor }).where(eq(slaEmailAllowlist.id, input.id)); return (await db.select().from(slaEmailAllowlist).where(eq(slaEmailAllowlist.id, input.id)).limit(1))[0]; }
export async function removeSlaEmailAllowlist(input: { id: number }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(slaEmailAllowlist).where(eq(slaEmailAllowlist.id, input.id)); return { success: true } as const; }
export async function isSlaEmailAllowed(email: string) { const db = await getDb(); if (!db) return false; const row = (await db.select({ id: slaEmailAllowlist.id }).from(slaEmailAllowlist).where(and(eq(slaEmailAllowlist.email, normalizeReceiptEmail(email)), eq(slaEmailAllowlist.enabled, true))).limit(1))[0]; return Boolean(row); }
export function isReceiptEmailCoolingDown(lastRequestedAt: Date | undefined, now = Date.now()) { return Boolean(lastRequestedAt && now - lastRequestedAt.getTime() < RECEIPT_EMAIL_COOLDOWN_MS); }
export function shouldCreateReceiptEmailFailureAlert(failureCount: number, hasRecentAlert: boolean) { return failureCount >= RECEIPT_EMAIL_FAILURE_THRESHOLD && !hasRecentAlert; }

export async function getLatestReceiptEmailAttempt(recipientEmail: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(receiptEmailAttempts).where(eq(receiptEmailAttempts.recipientEmail, normalizeReceiptEmail(recipientEmail))).orderBy(desc(receiptEmailAttempts.requestedAt)).limit(1);
  return rows[0];
}

export async function createReceiptEmailAttempt(input: { recipientEmail: string; storageKey: string; language: string; requestedAt?: Date }) {
  const db = await getDb();
  const requestedAt = input.requestedAt ?? new Date();
  const recipientEmail = normalizeReceiptEmail(input.recipientEmail);
  if (!db) return { id: 0, recipientEmail, requestedAt, storageKey: input.storageKey, language: input.language, status: "sending" as const };
  const result = await db.insert(receiptEmailAttempts).values({ recipientEmail, storageKey: input.storageKey, language: input.language, status: "sending", requestedAt });
  return { id: Number(result[0].insertId), recipientEmail, requestedAt, storageKey: input.storageKey, language: input.language, status: "sending" as const };
}

export async function finishReceiptEmailAttempt(input: { id: number; status: "sent" | "failed"; providerId?: string | null; error?: string | null; completedAt?: Date }) {
  const db = await getDb();
  if (db && input.id > 0) await db.update(receiptEmailAttempts).set({ status: input.status, providerId: input.providerId ?? null, error: input.error?.slice(0, 1000) ?? null, completedAt: input.completedAt ?? new Date() }).where(eq(receiptEmailAttempts.id, input.id));
}

export async function listReceiptEmailAttempts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receiptEmailAttempts).orderBy(desc(receiptEmailAttempts.requestedAt)).limit(Math.min(Math.max(limit, 1), 250));
}

export async function getReceiptEmailHistoryPage(input: { status?: "sending" | "sent" | "failed"; recipient?: string; page: number; pageSize: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize, totalPages: 0 };
  const filters = [];
  if (input.status) filters.push(eq(receiptEmailAttempts.status, input.status));
  if (input.recipient?.trim()) filters.push(like(receiptEmailAttempts.recipientEmail, `%${normalizeReceiptEmail(input.recipient)}%`));
  const where = filters.length ? and(...filters) : undefined;
  const [items, totals] = await Promise.all([
    db.select().from(receiptEmailAttempts).where(where).orderBy(desc(receiptEmailAttempts.requestedAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
    db.select({ value: count() }).from(receiptEmailAttempts).where(where),
  ]);
  const total = Number(totals[0]?.value ?? 0);
  return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
}

export async function recordReceiptEmailFailureAlert(recipientEmail: string, now = new Date()) {
  const db = await getDb();
  if (!db) return { shouldAlert: false, failureCount: 0 };
  const normalized = normalizeReceiptEmail(recipientEmail);
  const since = new Date(now.getTime() - RECEIPT_EMAIL_FAILURE_WINDOW_MS);
  const failures = await db.select({ id: receiptEmailAttempts.id }).from(receiptEmailAttempts).where(and(eq(receiptEmailAttempts.recipientEmail, normalized), eq(receiptEmailAttempts.status, "failed"), gte(receiptEmailAttempts.requestedAt, since)));
  const alerts = await db.select({ id: receiptEmailFailureAlerts.id }).from(receiptEmailFailureAlerts).where(and(eq(receiptEmailFailureAlerts.recipientEmail, normalized), gte(receiptEmailFailureAlerts.alertedAt, since))).limit(1);
  const shouldAlert = shouldCreateReceiptEmailFailureAlert(failures.length, alerts.length > 0);
  if (shouldAlert) await db.insert(receiptEmailFailureAlerts).values({ recipientEmail: normalized, failureCount: failures.length, alertedAt: now });
  return { shouldAlert, failureCount: failures.length };
}

export type SupportedCurrency = "USD" | "EUR" | "GBP";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["USD", "EUR", "GBP"];
export const SERVICE_PACKAGE_CODES = ["basic", "basic_plus"] as const;
export type ServicePackageCode = (typeof SERVICE_PACKAGE_CODES)[number];
const DEFAULT_SERVICE_PACKAGES = [
  { code: "basic", version: 1, packageType: "basic", nameEn: "Basic reading", nameRu: "Базовое чтение", nameDe: "Basisdeutung", nameEs: "Lectura básica", active: true, createdBy: "system" },
  { code: "basic_plus", version: 1, packageType: "basic_plus", nameEn: "Basic + numerology", nameRu: "Базовое + нумерология", nameDe: "Basisdeutung + Numerologie", nameEs: "Básica + numerología", active: true, createdBy: "system" },
] as const;

async function ensureServicePackageCatalog() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ id: servicePackages.id }).from(servicePackages).limit(1);
  if (existing.length === 0) await db.insert(servicePackages).values([...DEFAULT_SERVICE_PACKAGES]);
  return db;
}

export async function listServicePackages() {
  const db = await ensureServicePackageCatalog();
  if (!db) return [...DEFAULT_SERVICE_PACKAGES];
  return db.select().from(servicePackages).orderBy(asc(servicePackages.code), desc(servicePackages.version));
}

export async function listActiveServicePackages() {
  return (await listServicePackages()).filter((entry) => entry.active);
}

export async function getActiveServicePackage(code: ServicePackageCode) {
  return (await listActiveServicePackages()).find((entry) => entry.code === code) ?? null;
}

export async function setServicePackageActive(input: { code: ServicePackageCode; version: number; active: boolean; actor: string }) {
  const db = await ensureServicePackageCatalog();
  if (!db) throw new Error("Database unavailable");
  const target = (await db.select().from(servicePackages).where(and(eq(servicePackages.code, input.code), eq(servicePackages.version, input.version))).limit(1))[0];
  if (!target) throw new Error("Service package version not found.");
  if (!input.active && target.active) {
    const activePackages = await listActiveServicePackages();
    if (activePackages.length <= 1) throw new Error("At least one service package must remain active.");
  }
  await db.update(servicePackages).set({ active: input.active }).where(eq(servicePackages.id, target.id));
  return (await db.select().from(servicePackages).where(eq(servicePackages.id, target.id)).limit(1))[0];
}
export type ServicePricingConfig = { basicUsd: number; numerologyAddonUsd: number };
export type CurrencyPricingConfig = ServicePricingConfig & { currency: SupportedCurrency; updatedAt?: Date; updatedBy?: string };

function normalizeCurrency(currency?: string): SupportedCurrency { const normalized = (currency ?? "USD").toUpperCase(); return SUPPORTED_CURRENCIES.includes(normalized as SupportedCurrency) ? normalized as SupportedCurrency : "USD"; }

const defaultPricing = { basicUsd: READING_PRICES.basic, numerologyAddonUsd: READING_PRICES.numerologyAddon } as const;
const isTestRuntime = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
type TestPricingHistoryRow = { id: number; currency: SupportedCurrency; oldBasicAmount: number; oldNumerologyAddonAmount: number; newBasicAmount: number; newNumerologyAddonAmount: number; changedAt: Date; changedBy: string };
const testPricingOverrides = new Map<SupportedCurrency, ServicePricingConfig>();
const testPricingHistory: TestPricingHistoryRow[] = [];
let testPricingHistoryId = -1;

function filterTestPricingHistory(filters?: PricingHistoryFilters) {
  return testPricingHistory.filter((entry) => {
    if (filters?.currency && entry.currency !== filters.currency) return false;
    if (filters?.from && entry.changedAt < new Date(`${filters.from}T00:00:00.000Z`)) return false;
    if (filters?.to && entry.changedAt >= new Date(`${filters.to}T00:00:00.000Z`)) {
      const endExclusive = new Date(`${filters.to}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      if (entry.changedAt >= endExclusive) return false;
    }
    return true;
  }).sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime());
}

export async function getServicePricing(currency = "USD"): Promise<ServicePricingConfig> {
  const normalized = normalizeCurrency(currency);
  if (isTestRuntime && testPricingOverrides.has(normalized)) return testPricingOverrides.get(normalized)!;
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
  return SUPPORTED_CURRENCIES.map((currency) => { const override = isTestRuntime ? testPricingOverrides.get(currency) : undefined; const match = rows.find((row) => row.currency === currency); return override ? { currency, ...override } : match ? { ...match, currency } : { currency, ...defaultPricing }; });
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
  if (isTestRuntime) {
    const db = await getDb();
    const persisted = db ? await db.select().from(servicePricingHistory).where(pricingHistoryConditions(filters)).orderBy(desc(servicePricingHistory.changedAt)).limit(500) : [];
    const items = [...filterTestPricingHistory(filters), ...persisted].sort((left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime());
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
    const totalPages = Math.ceil(items.length / safePageSize);
    const actualPage = totalPages ? Math.min(safePage, totalPages) : 1;
    return { items: items.slice((actualPage - 1) * safePageSize, actualPage * safePageSize), total: items.length, page: actualPage, pageSize: safePageSize, totalPages };
  }
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
  if (isTestRuntime) {
    const persisted = db ? await db.select().from(servicePricingHistory).where(pricingHistoryConditions(filters)).orderBy(desc(servicePricingHistory.changedAt)).limit(500) : [];
    return [...filterTestPricingHistory(filters), ...persisted].sort((left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime()).slice(0, limit);
  }
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

export type SmokeTestRunsPageInput = { status?: "running" | "succeeded" | "failed"; sort?: "started_desc" | "started_asc" | "duration_desc" | "duration_asc"; page?: number; pageSize?: number };
export async function getSmokeTestRunsPage(input: SmokeTestRunsPageInput = {}) {
  const db = await getDb();
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 10)));
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  if (!db) return { items: [], total: 0, page: requestedPage, pageSize, totalPages: 0 };
  const where = input.status ? eq(smokeTestRuns.status, input.status) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(smokeTestRuns).where(where);
  const totalPages = Math.ceil(total / pageSize);
  const page = totalPages ? Math.min(requestedPage, totalPages) : 1;
  const sort = input.sort ?? "started_desc";
  const order = sort === "started_asc" ? asc(smokeTestRuns.startedAt) : sort === "duration_desc" ? desc(smokeTestRuns.durationMs) : sort === "duration_asc" ? asc(smokeTestRuns.durationMs) : desc(smokeTestRuns.startedAt);
  const items = await db.select().from(smokeTestRuns).where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize);
  return { items, total, page, pageSize, totalPages };
}

export async function getSmokeTestRunsForExport(input: Omit<SmokeTestRunsPageInput, "page" | "pageSize"> = {}) {
  const firstPage = await getSmokeTestRunsPage({ ...input, page: 1, pageSize: 50 });
  const items = [...firstPage.items];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await getSmokeTestRunsPage({ ...input, page, pageSize: 50 });
    items.push(...nextPage.items);
  }
  return items;
}

export async function updateServicePricing(input: ServicePricingConfig & { currency?: string; updatedBy: string }) {
  const currency = normalizeCurrency(input.currency);
  const previous = await getServicePricing(currency);
  if (isTestRuntime) {
    if (previous.basicUsd !== input.basicUsd || previous.numerologyAddonUsd !== input.numerologyAddonUsd) {
      testPricingHistory.push({ id: testPricingHistoryId--, currency, oldBasicAmount: previous.basicUsd, oldNumerologyAddonAmount: previous.numerologyAddonUsd, newBasicAmount: input.basicUsd, newNumerologyAddonAmount: input.numerologyAddonUsd, changedAt: new Date(), changedBy: input.updatedBy });
    }
    testPricingOverrides.set(currency, { basicUsd: input.basicUsd, numerologyAddonUsd: input.numerologyAddonUsd });
    return { basicUsd: input.basicUsd, numerologyAddonUsd: input.numerologyAddonUsd };
  }
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
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
