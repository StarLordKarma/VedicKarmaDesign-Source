import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolveDatabaseUrl } from "./_core/database-url";

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) throw new Error("Database configuration is required");

  const db = drizzle(databaseUrl);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed successfully");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Database migration failed: ${message}`);
  process.exit(1);
});
