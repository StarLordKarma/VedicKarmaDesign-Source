import mysql from "mysql2/promise";

if (process.env.DEPLOYMENT_MODE !== "independent")
  throw new Error("Production seed requires DEPLOYMENT_MODE=independent.");
if (process.env.PRODUCTION_SEED_CONFIRM !== "INITIALIZE-REFERENCE-DATA")
  throw new Error(
    "Refusing to seed: set PRODUCTION_SEED_CONFIRM=INITIALIZE-REFERENCE-DATA."
  );
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();
  await db.execute(
    `INSERT INTO service_pricing (id,basicUsd,numerologyAddonUsd,updatedBy)
     VALUES (1,25,10,'production-initialization')
     ON DUPLICATE KEY UPDATE id=id`
  );
  await db.execute(
    `INSERT INTO service_packages
      (code,version,packageType,nameEn,nameRu,nameDe,nameEs,active,createdBy)
     VALUES
      ('basic',1,'basic','Basic reading','Базовое чтение','Basisdeutung','Lectura básica',true,'production-initialization'),
      ('basic_plus',1,'basic_plus','Basic + numerology','Базовое + нумерология','Basis + Numerologie','Básica + numerología',true,'production-initialization')
     ON DUPLICATE KEY UPDATE code=code`
  );
  await db.commit();
  console.info(
    "Production reference pricing/packages are present; existing values were preserved."
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
