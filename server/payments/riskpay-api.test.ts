import { describe, expect, it, vi } from "vitest";
import {
  createRiskPayApi,
  parseRiskPayWallet,
  riskPayHostedUrl,
} from "./riskpay-api";
import { riskPayFixture } from "./riskpay-fixture";
import {
  evaluateRiskPaySettlement,
  POLYGON_NATIVE_USDC,
} from "./riskpay-settlement";
const merchant = "0x1111111111111111111111111111111111111111",
  assigned = "0x2222222222222222222222222222222222222222";
const callback =
  "https://shop.example.test/api/riskpay/callback?order=7&token=" +
  "a".repeat(64);
const rawWallet = {
  address_in: "encrypted%2Fwallet%2B%3D",
  polygon_address_in: assigned,
  callback_url: callback,
  ipn_token: "private-ipn%2Ftoken%3D",
};
describe("documented RiskPay protocol", () => {
  it("creates the documented wallet request using only the merchant wallet and unique callback", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(rawWallet), { status: 200 })
    );
    const api = createRiskPayApi({ mode: "fixture", fetcher });
    const wallet = await api.createWallet({
      merchantWallet: merchant,
      callbackUrl: callback,
    });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin).toBe("https://api.riskpay.biz");
    expect(url.pathname).toBe("/control/wallet.php");
    expect(url.searchParams.get("address")).toBe(merchant);
    expect(url.searchParams.get("callback")).toBe(callback);
    expect(wallet).toMatchObject({
      encryptedAddress: "encrypted/wallet+=",
      ipnToken: "private-ipn/token=",
    });
    expect([...url.searchParams.keys()]).toEqual(["address", "callback"]);
  });
  it.each(["card", "apple_pay", "google_pay"] as const)(
    "uses the multi-provider page without inventing a wallet-selector parameter for %s",
    method => {
      const wallet = parseRiskPayWallet(rawWallet, callback);
      const url = new URL(
        riskPayHostedUrl({
          wallet,
          email: "client+tag@example.test",
          grossCents: 499,
          currency: "USD",
          method,
        })
      );
      expect(url.origin).toBe("https://pay.riskpay.biz");
      expect(url.pathname).toBe("/payment-creating.php");
      expect(url.searchParams.get("address")).toBe("encrypted/wallet+=");
      expect(url.searchParams.get("amount")).toBe("4.99");
      expect(url.searchParams.get("email")).toBe("client+tag@example.test");
      expect(url.searchParams.has("method")).toBe(false);
      expect(url.searchParams.has("ipn_token")).toBe(false);
    }
  );
  it("does not call live APIs without explicit opt-in or allow fixture mode to fall through to fetch", async () => {
    const fetcher = vi.fn();
    await expect(
      createRiskPayApi({ mode: "live", env: {}, fetcher }).createWallet({
        merchantWallet: merchant,
        callbackUrl: callback,
      })
    ).rejects.toThrow("not enabled");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      createRiskPayApi({ mode: "fixture" }).createWallet({
        merchantWallet: merchant,
        callbackUrl: callback,
      })
    ).rejects.toThrow("offline transport");
  });
  it("rejects wrong callback bindings, invalid wallets and failed API responses", async () => {
    expect(() =>
      parseRiskPayWallet(
        { ...rawWallet, callback_url: "https://wrong.example.test" },
        callback
      )
    ).toThrow("binding");
    const fetcher = vi.fn(async () => new Response("{}", { status: 503 }));
    await expect(
      createRiskPayApi({ mode: "fixture", fetcher }).createWallet({
        merchantWallet: merchant,
        callbackUrl: callback,
      })
    ).rejects.toThrow("failed");
    await expect(
      createRiskPayApi({ mode: "fixture", fetcher }).createWallet({
        merchantWallet: merchant,
        callbackUrl: "https://shop.example.test/callback",
      })
    ).rejects.toThrow("unique");
  });
  it("keeps offline fixtures deterministic, distinct between orders and bound to their callbacks", async () => {
    const wallet = await riskPayFixture("order-1").createWallet({
      merchantWallet: merchant,
      callbackUrl: callback,
    });
    const again = await riskPayFixture("order-1").createWallet({
      merchantWallet: merchant,
      callbackUrl: callback,
    });
    const second = await riskPayFixture("order-2").createWallet({
      merchantWallet: merchant,
      callbackUrl: callback.replace("order=7", "order=8"),
    });
    expect(wallet).toEqual(again);
    expect(wallet.assignedAddress).not.toBe(second.assignedAddress);
  });
  it("supports manual status investigation using the documented token without polling checkout redirects", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "unpaid" }), { status: 200 })
    );
    expect(
      await createRiskPayApi({ mode: "fixture", fetcher }).status(
        "private-ipn-token"
      )
    ).toEqual({ status: "unpaid" });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/control/payment-status.php");
    expect(url.searchParams.get("ipn_token")).toBe("private-ipn-token");
  });
});
const topic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const hash = (s: string) => "0x" + s.repeat(64),
  addrTopic = (s: string) => "0x" + s.slice(2).padStart(64, "0");
const transfer = (from: string, to: string, n: string) => ({
  address: POLYGON_NATIVE_USDC,
  topics: [topic, addrTopic(from), addrTopic(to)],
  data: "0x" + BigInt(n).toString(16).padStart(64, "0"),
  logIndex: "0x1",
});
function evidence() {
  return {
    callback: {
      value_coin: "50",
      coin: "polygon_usdc",
      txid_in: hash("a"),
      txid_out: hash("b"),
      address_in: assigned,
    },
    assignedAddress: assigned,
    merchantAddress: merchant,
    chainId: "0x89",
    finalizedBlock: "0x20",
    incoming: {
      receipt: {
        transactionHash: hash("a"),
        status: "0x1",
        blockNumber: "0x10",
        blockHash: hash("c"),
        logs: [
          transfer(
            "0x3333333333333333333333333333333333333333",
            assigned,
            "50000000"
          ),
        ],
      },
      canonicalBlockHash: hash("c"),
      blockTimestamp: 90,
    },
    outgoing: {
      receipt: {
        transactionHash: hash("b"),
        status: "0x1",
        blockNumber: "0x11",
        blockHash: hash("d"),
        logs: [transfer(assigned, merchant, "44000000")],
      },
      canonicalBlockHash: hash("d"),
      blockTimestamp: 91,
    },
    quote: {
      incomingMicroUsdc: "50000000",
      merchantMicroUsdc: "44000000",
      expiresAt: 100,
    },
  };
}
describe("independent RiskPay settlement gate", () => {
  it("does not approve even a paid callback without an authoritative net settlement quote", () => {
    expect(
      evaluateRiskPaySettlement({ ...evidence(), quote: undefined })
    ).toMatchObject({
      status: "under_review",
      reason: "missing_authoritative_settlement_quote",
    });
  });
  it("requires both finalized canonical native-USDC transfers and returns a globally claimable log identity", () => {
    expect(evaluateRiskPaySettlement(evidence())).toEqual({
      status: "verified",
      claim: "0x89:" + hash("b") + ":0x1",
      merchantMicroUsdc: "44000000",
    });
  });
  it("normalizes log identity so hex padding cannot bypass the unique payment claim", () => {
    const p = evidence();
    const first = evaluateRiskPaySettlement(p);
    p.outgoing.receipt.logs[0].logIndex = "0x0001";
    expect(evaluateRiskPaySettlement(p)).toEqual(first);
  });
  it.each([
    "token",
    "recipient",
    "sender",
    "amount",
    "pending",
    "reorg",
    "failed",
    "duplicate_log",
    "late",
    "chain",
    "order",
  ] as const)("rejects %s evidence", kind => {
    const p = evidence(),
      log = p.outgoing.receipt.logs[0];
    if (kind === "token")
      log.address = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    if (kind === "recipient") log.topics[2] = addrTopic(assigned);
    if (kind === "sender") log.topics[1] = addrTopic(merchant);
    if (kind === "amount") log.data = "0x" + "0".repeat(63) + "1";
    if (kind === "pending") p.outgoing.receipt.blockNumber = "0x21";
    if (kind === "reorg") p.outgoing.canonicalBlockHash = hash("e");
    if (kind === "failed") p.outgoing.receipt.status = "0x0";
    if (kind === "duplicate_log")
      p.outgoing.receipt.logs.push({ ...log, logIndex: "0x2" });
    if (kind === "late") p.incoming.blockTimestamp = 101;
    if (kind === "chain") p.chainId = "0x1";
    if (kind === "order") p.callback.address_in = merchant;
    expect(evaluateRiskPaySettlement(p).status).toBe("under_review");
  });
});

import { riskPayPolygonRpc, verifyRiskPayOnChain } from "./riskpay-chain";
describe("RiskPay independent RPC integration", () => {
  it("uses canonical Polygon receipts and finalized blocks, not a paid flag from the provider", async () => {
    const p = evidence();
    const rpc = vi.fn(async (method: string, params: unknown[]) => {
      if (method === "eth_chainId") return "0x89";
      if (method === "eth_getBlockByNumber" && params[0] === "finalized")
        return { number: "0x20" };
      if (method === "eth_getTransactionReceipt")
        return params[0] === p.callback.txid_in
          ? p.incoming.receipt
          : p.outgoing.receipt;
      if (method === "eth_getBlockByNumber")
        return params[0] === "0x10"
          ? { hash: p.incoming.canonicalBlockHash, timestamp: "0x5a" }
          : { hash: p.outgoing.canonicalBlockHash, timestamp: "0x5b" };
      throw Error("Unexpected RPC request");
    });
    expect(
      (
        await verifyRiskPayOnChain({
          rpc,
          callback: p.callback,
          assignedAddress: assigned,
          merchantAddress: merchant,
          quote: p.quote,
        })
      ).status
    ).toBe("verified");
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      "eth_chainId",
      "eth_getBlockByNumber",
      "eth_getTransactionReceipt",
      "eth_getBlockByNumber",
      "eth_getTransactionReceipt",
      "eth_getBlockByNumber",
    ]);
  });
  it("fails closed for a wrong network, unavailable finality, or a pending transaction", async () => {
    const p = evidence(),
      input = {
        callback: p.callback,
        assignedAddress: assigned,
        merchantAddress: merchant,
        quote: p.quote,
      };
    await expect(
      verifyRiskPayOnChain({ ...input, rpc: async () => "0x1" })
    ).rejects.toThrow("Wrong");
    await expect(
      verifyRiskPayOnChain({
        ...input,
        rpc: async method => (method === "eth_chainId" ? "0x89" : null),
      })
    ).rejects.toThrow("finalized");
    await expect(
      verifyRiskPayOnChain({
        ...input,
        rpc: async method =>
          method === "eth_chainId"
            ? "0x89"
            : method === "eth_getBlockByNumber"
              ? { number: "0x20" }
              : null,
      })
    ).rejects.toThrow("not mined");
  });
  it("requires HTTPS and refuses redirects for independent RPC calls", async () => {
    expect(() => riskPayPolygonRpc("http://rpc.example.test")).toThrow("HTTPS");
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x89" }))
    );
    expect(
      await riskPayPolygonRpc("https://rpc.example.test", fetcher)(
        "eth_chainId",
        []
      )
    ).toBe("0x89");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      method: "POST",
    });
  });
});
