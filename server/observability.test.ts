import { describe, expect, it, vi } from "vitest";
import { createRateLimit, sanitizeLogMeta, trpcRateLimitMiddleware } from "./observability";

function request(ip = "203.0.113.10") {
  return { ip, socket: { remoteAddress: ip }, header: () => undefined } as any;
}

function response() {
  const headers = new Map<string, string | number>();
  return {
    headers,
    setHeader(name: string, value: string | number) { headers.set(name, value); },
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json: vi.fn(),
  } as any;
}

describe("observability", () => {
  it("redacts sensitive keys without changing safe metadata", () => {
    expect(sanitizeLogMeta({ requestId: "req-1", bookingId: 12, email: "person@example.com", birthDate: "1990-01-01", nested: { token: "secret" } })).toEqual({
      requestId: "req-1",
      bookingId: 12,
      email: "[REDACTED]",
      birthDate: "[REDACTED]",
      nested: { token: "[REDACTED]" },
    });
  });

  it("limits a scope per client key and returns retry metadata", () => {
    const limiter = createRateLimit({ name: "test", windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const first = response();
    const second = response();
    const third = response();
    limiter(request(), first, next);
    limiter(request(), second, next);
    limiter(request(), third, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(third.statusCode).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTypeOf("number");
    expect(third.json).toHaveBeenCalledWith(expect.objectContaining({ error: "rate_limited" }));
  });

  it("does not share buckets between client keys", () => {
    const limiter = createRateLimit({ name: "test-isolated", windowMs: 60_000, max: 1 });
    const next = vi.fn();
    limiter(request("203.0.113.10"), response(), next);
    limiter(request("203.0.113.11"), response(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("matches mounted tRPC procedures through originalUrl", () => {
    const next = vi.fn();
    for (let index = 0; index < 6; index += 1) {
      const req = { ...request("198.51.100.20"), originalUrl: "/api/trpc/booking.submit" };
      const res = response();
      trpcRateLimitMiddleware(req, res, next);
      if (index === 5) expect(res.statusCode).toBe(429);
    }
    expect(next).toHaveBeenCalledTimes(5);
  });
});
