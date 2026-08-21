import { describe, expect, it } from "vitest";
import { READING_PRICES } from "./pricing";

describe("reading prices", () => {
  it("uses the current Basic and add-on prices", () => {
    expect(READING_PRICES.basic).toBe(25);
    expect(READING_PRICES.numerologyAddon).toBe(10);
  });
});
