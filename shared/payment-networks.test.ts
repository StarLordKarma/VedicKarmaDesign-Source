import { describe, expect, it } from "vitest";
import {
  formatTokenUnits,
  recommendPaymentNetwork,
  type NetworkEstimate,
} from "./payment-networks";
const entry = (
  network: NetworkEstimate["network"],
  status: NetworkEstimate["status"],
  fee?: number
): NetworkEstimate => ({
  network,
  status,
  estimatedUsd: fee,
  quotedAt: Date.now(),
});
describe("funded network fee comparison", () => {
  it("compares only wallets that can already pay", () => {
    expect(
      recommendPaymentNetwork([
        entry("ethereum", "ready", 2),
        entry("polygon", "insufficient_usdt", 0.001),
      ])
    ).toBe("ethereum");
  });
  it("includes a connected TRON wallet in the same USD comparison", () => {
    expect(
      recommendPaymentNetwork([
        entry("avalanche", "ready", 0.02),
        entry("tron", "ready", 0.01),
        entry("bnb", "ready", 0.04),
      ])
    ).toBe("tron");
  });
  it("does not invent a cheapest network when a payable fee lacks a USD price", () => {
    expect(
      recommendPaymentNetwork([
        entry("avalanche", "ready", 0.02),
        entry("bnb", "ready"),
      ])
    ).toBeNull();
  });
  it("does not recommend a network with insufficient gas", () => {
    expect(
      recommendPaymentNetwork([entry("bnb", "insufficient_gas", 0.01)])
    ).toBeNull();
  });
  it("formats small native fees and 18-decimal token balances exactly", () => {
    expect(formatTokenUnits("25000000000000000000")).toBe("25");
    expect(formatTokenUnits("1")).toBe("0.000000000000000001");
    expect(formatTokenUnits("25000000", 6)).toBe("25");
  });
});
