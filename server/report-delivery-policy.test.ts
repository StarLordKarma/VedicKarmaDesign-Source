import { describe, expect, it } from "vitest";
import {
  assertDeliveryRetryWindow,
  isDeliveryLeaseExpired,
} from "./report-delivery-policy";

describe("report delivery recovery", () => {
  const now = Date.UTC(2026, 9, 21);
  it("does not reclaim a fresh retry of an older attempt", () => {
    expect(
      isDeliveryLeaseExpired(
        {
          requestedAt: new Date(now - 30 * 60000),
          startedAt: new Date(now - 60000),
        },
        now
      )
    ).toBe(false);
  });
  it("recovers an interrupted send after five minutes", () => {
    expect(
      isDeliveryLeaseExpired(
        {
          requestedAt: new Date(now - 30 * 60000),
          startedAt: new Date(now - 300001),
        },
        now
      )
    ).toBe(true);
  });
  it("supports attempts created before the lease migration", () => {
    expect(
      isDeliveryLeaseExpired(
        {
          requestedAt: new Date(now - 300001),
          startedAt: null,
        },
        now
      )
    ).toBe(true);
  });
  it("allows retries within the provider deduplication window", () => {
    expect(() =>
      assertDeliveryRetryWindow(new Date(now - 3600000), now)
    ).not.toThrow();
  });
  it("blocks manual or automatic retries before deduplication expires", () => {
    expect(() =>
      assertDeliveryRetryWindow(new Date(now - 23 * 3600000), now)
    ).toThrow("retry window expired");
  });
});
