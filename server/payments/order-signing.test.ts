import { describe, expect, it } from "vitest";
import { orderSigningKey } from "./order-signing";
import { SignJWT, jwtVerify } from "jose";
describe("isolated order signatures", () => {
  it("uses the invoice key instead of the owner session key", async () => {
    const key = orderSigningKey({
      ORDER_SIGNING_SECRET: "order-".repeat(12),
      JWT_SECRET: "login-".repeat(12),
    });
    const token = await new SignJWT({ bookingId: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("direct-payment")
      .setExpirationTime("5m")
      .sign(key);
    expect(
      (
        await jwtVerify(token, key, {
          audience: "direct-payment",
          algorithms: ["HS256"],
        })
      ).payload.bookingId
    ).toBe(1);
    await expect(
      jwtVerify(token, new TextEncoder().encode("login-".repeat(12)), {
        algorithms: ["HS256"],
      })
    ).rejects.toThrow();
  });
  it("preserves the legacy session-key fallback", () => {
    expect(orderSigningKey({ JWT_SECRET: "legacy-".repeat(8) })).toEqual(
      new TextEncoder().encode("legacy-".repeat(8))
    );
  });
  it("fails closed for weak or placeholder invoice keys", () => {
    expect(() => orderSigningKey({})).toThrow("strong");
    expect(() =>
      orderSigningKey({
        ORDER_SIGNING_SECRET: "short",
        JWT_SECRET: "legacy-".repeat(8),
      })
    ).toThrow("strong");
    expect(() =>
      orderSigningKey({
        ORDER_SIGNING_SECRET: "replace-with-a-very-long-example-secret-value",
      })
    ).toThrow("strong");
  });
});
