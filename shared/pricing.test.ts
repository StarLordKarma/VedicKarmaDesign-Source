import { describe, expect, it } from "vitest";
import { READING_PRICES } from "./pricing";
import { servicePricingSchema } from "./admin";

describe("reading prices", () => {
  it("validates owner-managed service pricing values", () => {
    expect(servicePricingSchema.safeParse({ basicUsd: 40, numerologyAddonUsd: 15 }).success).toBe(true);
    expect(servicePricingSchema.safeParse({ basicUsd: 1, numerologyAddonUsd: 0 }).success).toBe(true);
    expect(servicePricingSchema.safeParse({ basicUsd: 0, numerologyAddonUsd: 10 }).success).toBe(false);
    expect(servicePricingSchema.safeParse({ basicUsd: 10.5, numerologyAddonUsd: 10 }).success).toBe(false);
    expect(servicePricingSchema.safeParse({ basicUsd: 10001, numerologyAddonUsd: 10 }).success).toBe(false);
    expect(servicePricingSchema.parse({ basicUsd: 25, numerologyAddonUsd: 10 }).currency).toBe("USD");
    expect(servicePricingSchema.safeParse({ currency: "JPY", basicUsd: 25, numerologyAddonUsd: 10 }).success).toBe(false);
  });

  it("uses the current Basic and add-on prices", () => {
    expect(READING_PRICES.basic).toBe(25);
    expect(READING_PRICES.numerologyAddon).toBe(10);
  });
});
