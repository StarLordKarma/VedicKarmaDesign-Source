import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { resolveDatabaseUrl } from "./_core/database-url";

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) throw new Error("Database configuration is required");

  const db = drizzle(databaseUrl);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed successfully");
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Database migration failed: ${message}`);
  const cause =
    error instanceof Error && "cause" in error
      ? (error.cause as Record<string, unknown> | undefined)
      : undefined;
  if (cause) {
    const details = {
      code: typeof cause.code === "string" ? cause.code : undefined,
      errno: typeof cause.errno === "number" ? cause.errno : undefined,
      sqlState:
        typeof cause.sqlState === "string" ? cause.sqlState : undefined,
      sqlMessage:
        typeof cause.sqlMessage === "string" ? cause.sqlMessage : undefined,
    };
    console.error(`MySQL error details: ${JSON.stringify(details)}`);
  }
  process.exit(1);
});
