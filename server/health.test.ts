import { describe, expect, it, vi } from "vitest";
import { healthHandler, readinessHandler } from "./health";

function response() {
  return {
    statusCode: 0,
    status(code: number) { this.statusCode = code; return this; },
    json: vi.fn(),
  } as any;
}

describe("health endpoints", () => {
  it("returns a minimal liveness response", () => {
    const res = response();
    healthHandler({} as any, res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, service: "vedic-astrology-booking" });
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/DATABASE_URL|JWT_SECRET|OWNER_OPEN_ID|email/i);
  });

  it("returns not-ready when the database is not configured", async () => {
    const res = response();
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await readinessHandler({} as any, res, vi.fn());
    if (previous !== undefined) process.env.DATABASE_URL = previous;
    expect(res.statusCode).toBe(503);
    expect(res.json).toHaveBeenCalledWith({ ok: false, checks: { database: false } });
  });
});
