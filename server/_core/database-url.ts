const NORTHFLANK_DATABASE_KEYS = [
  "NF_VEDIC_KARMA_MYSQL_HOST",
  "NF_VEDIC_KARMA_MYSQL_USERNAME",
  "NF_VEDIC_KARMA_MYSQL_PASSWORD",
  "NF_VEDIC_KARMA_MYSQL_DATABASE",
] as const;

export function hasDatabaseConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.DATABASE_URL?.trim() ||
      NORTHFLANK_DATABASE_KEYS.every(key => env[key]?.trim())
  );
}

/**
 * Resolve a mysql2-compatible URL without logging credentials. Northflank's
 * linked MySQL add-on exposes separate fields as well as an ADO.NET-style
 * connector string; mysql2 only accepts a mysql:// URL.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env.DATABASE_URL?.trim()) {
    if (!env.DATABASE_URL.startsWith("mysql://")) {
      throw new Error("DATABASE_URL must use the mysql:// scheme");
    }
    return env.DATABASE_URL;
  }

  if (!NORTHFLANK_DATABASE_KEYS.every(key => env[key]?.trim())) return "";

  const user = encodeURIComponent(env.NF_VEDIC_KARMA_MYSQL_USERNAME!);
  const password = encodeURIComponent(env.NF_VEDIC_KARMA_MYSQL_PASSWORD!);
  const host = env.NF_VEDIC_KARMA_MYSQL_HOST!;
  const port = env.NF_VEDIC_KARMA_MYSQL_PORT?.trim() || "3306";
  const database = encodeURIComponent(env.NF_VEDIC_KARMA_MYSQL_DATABASE!);
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}
