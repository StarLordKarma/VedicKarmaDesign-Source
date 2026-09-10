import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (process.env.STAGING_SEED_CONFIRM !== "true") {
  throw new Error("Refusing to seed: set STAGING_SEED_CONFIRM=true explicitly.");
}
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const parsed = new URL(databaseUrl);
const allowedHosts = new Set(["127.0.0.1", "localhost", "mysql"]);
if (!allowedHosts.has(parsed.hostname) && process.env.ALLOW_REMOTE_STAGING_SEED !== "true") {
  throw new Error("Refusing to seed a remote database without ALLOW_REMOTE_STAGING_SEED=true.");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.beginTransaction();
  await connection.execute(
    `INSERT INTO service_pricing (id, basicUsd, numerologyAddonUsd, updatedBy)
     VALUES (1, 25, 10, 'staging-seed')
     ON DUPLICATE KEY UPDATE basicUsd = VALUES(basicUsd),
       numerologyAddonUsd = VALUES(numerologyAddonUsd), updatedBy = VALUES(updatedBy)`
  );
  await connection.execute(
    `INSERT INTO service_packages
      (code, version, packageType, nameEn, nameRu, nameDe, nameEs, active, createdBy)
     VALUES
      ('basic', 1, 'basic', 'Basic reading', 'Базовое чтение', 'Basisdeutung', 'Lectura básica', true, 'staging-seed'),
      ('basic_plus', 1, 'basic_plus', 'Basic + numerology', 'Базовое + нумерология', 'Basis + Numerologie', 'Básica + numerología', true, 'staging-seed')
     ON DUPLICATE KEY UPDATE active = VALUES(active), createdBy = VALUES(createdBy)`
  );
  await connection.commit();
  console.info("Staging reference pricing and package records are ready.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
