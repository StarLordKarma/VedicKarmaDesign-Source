import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

if (process.env.SANDBOX_SEED_CONFIRM !== "true")
  throw new Error("Refusing to seed: set SANDBOX_SEED_CONFIRM=true.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const parsed = new URL(process.env.DATABASE_URL);
if (!["mysql", "localhost", "127.0.0.1"].includes(parsed.hostname))
  throw new Error("Sandbox seed is restricted to the local Compose database.");
const db = await mysql.createConnection(process.env.DATABASE_URL);
const sha = value => createHash("sha256").update(value).digest("hex");
const locales = [
  { code: "en", language: "English" },
  { code: "ru", language: "Русский" },
  { code: "de", language: "Deutsch" },
  { code: "es", language: "Español" },
];
try {
  await db.beginTransaction();
  await db.execute(
    `INSERT INTO users (openId,name,email,loginMethod,role) VALUES ('sandbox-owner','Sandbox Owner','owner@sandbox.invalid','sandbox','admin') ON DUPLICATE KEY UPDATE name=VALUES(name),role='admin'`
  );
  await db.execute(
    `INSERT INTO service_pricing (id,basicUsd,numerologyAddonUsd,updatedBy) VALUES (1,25,10,'sandbox-seed') ON DUPLICATE KEY UPDATE basicUsd=25,numerologyAddonUsd=10,updatedBy='sandbox-seed'`
  );
  await db.execute(
    `INSERT INTO service_packages (code,version,packageType,nameEn,nameRu,nameDe,nameEs,active,createdBy) VALUES ('basic',1,'basic','Basic reading','Базовое чтение','Basisdeutung','Lectura básica',true,'sandbox-seed'),('basic_plus',1,'basic_plus','Basic + numerology','Базовое + нумерология','Basis + Numerologie','Básica + numerología',true,'sandbox-seed') ON DUPLICATE KEY UPDATE active=true`
  );
  await db.execute(
    `DELETE FROM report_jobs WHERE idempotencyKey LIKE 'sandbox-seed:%'`
  );
  await db.execute(
    `DELETE FROM booking_requests WHERE email LIKE '%@sandbox.invalid'`
  );
  for (const [index, locale] of locales.entries()) {
    const email = `client-${locale.code}@sandbox.invalid`;
    const [result] = await db.execute(
      `INSERT INTO booking_requests (name,email,birthDate,birthTime,birthCity,birthCountry,language,addon,packageCode,packageVersion,priceSnapshotJson,totalUsd,currency,interest,privacyConsentVersion,privacyConsentLocale,privacyConsentAt,paymentStatus,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?,?)`,
      [
        `Sandbox ${locale.code.toUpperCase()}`,
        email,
        "1990-01-01",
        "12:00",
        "Berlin",
        "Germany",
        locale.language,
        index % 2,
        index % 2 ? "basic_plus" : "basic",
        1,
        JSON.stringify({ sandbox: true }),
        index % 2 ? 35 : 25,
        "USD",
        "Synthetic sandbox fixture; no real person.",
        "privacy-2026-08",
        locale.code,
        index === 0 ? "waiting" : "confirmed",
        index === 0 ? "new" : "in_progress",
      ]
    );
    const bookingId = Number(result.insertId);
    if (index > 0)
      await db.execute(
        `INSERT INTO report_jobs (bookingId,reportVersion,packageType,language,status,testJob,idempotencyKey,inputHash,queuedAt) VALUES (?,?,?,?,?,true,?,?,NOW())`,
        [
          bookingId,
          1,
          index % 2 ? "basic_plus" : "basic",
          locale.code,
          "queued",
          `sandbox-seed:${locale.code}`,
          sha(`${bookingId}:${locale.code}`),
        ]
      );
  }
  await db.commit();
  console.info(
    "Sandbox owner, four localized bookings and three queued test reports are ready."
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
