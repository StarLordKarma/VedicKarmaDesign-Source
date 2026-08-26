import { describe, expect, it } from "vitest";

describe("owner alert recipient", () => {
  it("is configured as a valid email address", () => {
    const address = process.env.OWNER_ALERT_EMAIL;
    expect(address, "OWNER_ALERT_EMAIL must be configured").toBeTruthy();
    expect(address).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
