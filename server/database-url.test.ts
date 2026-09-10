import { describe, expect, it } from "vitest";
import {
  hasDatabaseConfiguration,
  resolveDatabaseUrl,
} from "./_core/database-url";

describe("database URL resolution", () => {
  it("keeps a standard MySQL URL unchanged", () => {
    const url = "mysql://app:secret@database:3306/vedic";
    expect(resolveDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it("builds a mysql2 URL from Northflank linked add-on fields", () => {
    const env = {
      NF_VEDIC_KARMA_MYSQL_HOST: "mysql.internal",
      NF_VEDIC_KARMA_MYSQL_PORT: "3306",
      NF_VEDIC_KARMA_MYSQL_USERNAME: "vedic@app",
      NF_VEDIC_KARMA_MYSQL_PASSWORD: "p:a/ss",
      NF_VEDIC_KARMA_MYSQL_DATABASE: "vedic karma",
    };
    expect(hasDatabaseConfiguration(env)).toBe(true);
    expect(resolveDatabaseUrl(env)).toBe(
      "mysql://vedic%40app:p%3Aa%2Fss@mysql.internal:3306/vedic%20karma"
    );
  });

  it("rejects incompatible connector strings without revealing them", () => {
    expect(() =>
      resolveDatabaseUrl({ DATABASE_URL: "server=db;uid=user;password=secret" })
    ).toThrow("DATABASE_URL must use the mysql:// scheme");
  });
});
