import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimatePaymentNetworks } from "./direct-estimates";
import type { Intent } from "./direct";
const intent: Intent = {
  bookingId: 1,
  id: "ab".repeat(32),
  amount: "25.00",
  units: "25000000",
  recipient: `0x${"12".repeat(20)}`,
  startBlock: "0x10",
  deadline: 9999999999,
  options: [{ network: "bnb", startBlock: "0x10" }],
};
let balance: string, tokenBalance: string;
beforeEach(() => {
  vi.stubEnv("DIRECT_BNB_RPC_URL", "https://bnb.example.test");
  balance = "0xde0b6b3a7640000";
  tokenBalance = `0x${BigInt("25000000000000000000").toString(16)}`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      if (String(url).includes("coinbase"))
        return new Response(
          JSON.stringify({ data: { currency: "USD", rates: { BNB: ".001" } } })
        );
      const { method } = JSON.parse(init.body);
      const result =
        method === "eth_chainId"
          ? "0x38"
          : method === "eth_getBalance"
            ? balance
            : method === "eth_call"
              ? tokenBalance
              : method === "eth_estimateGas"
                ? "0x10000"
                : method === "eth_gasPrice"
                  ? "0x3b9aca00"
                  : { baseFeePerGas: "0x1" };
      return new Response(JSON.stringify({ result }));
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("real transaction preflight", () => {
  it("uses 18 decimal Binance-Peg units and includes a gas reserve", async () => {
    const [quote] = await estimatePaymentNetworks(
      intent,
      `0x${"34".repeat(20)}`
    );
    expect(quote.status).toBe("ready");
    expect(quote.tokenBalance).toBe("25");
    expect(Number(quote.budgetNative)).toBeGreaterThan(
      Number(quote.estimatedNative)
    );
    const simulation = vi
      .mocked(fetch)
      .mock.calls.find(
        c =>
          c[1]?.body &&
          JSON.parse(String(c[1].body)).method === "eth_estimateGas"
      );
    expect(JSON.parse(String(simulation![1]!.body)).params[0].data).toContain(
      BigInt("25000000000000000000").toString(16).padStart(64, "0")
    );
  });
  it("does not simulate an unfunded token transfer or label it free", async () => {
    tokenBalance = "0x1";
    const [quote] = await estimatePaymentNetworks(
      intent,
      `0x${"34".repeat(20)}`
    );
    expect(quote.status).toBe("insufficient_usdt");
    expect(quote.estimatedNative).toBeUndefined();
  });
  it("blocks payment when BNB does not cover the conservative fee", async () => {
    balance = "0x0";
    const [quote] = await estimatePaymentNetworks(
      intent,
      `0x${"34".repeat(20)}`
    );
    expect(quote.status).toBe("insufficient_gas");
  });
});
