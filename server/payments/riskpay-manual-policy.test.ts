import { expect, it, vi } from "vitest";
import {
  assertManualFulfillment,
  assertManualOrderUnchanged,
  manualDigest,
  manualOrderIdentity,
  riskPayManualEnabled,
  verifyRiskPayManualReceipt,
} from "./riskpay-manual-policy";
import { POLYGON_NATIVE_USDC } from "./riskpay-settlement";
const merchant = "0x" + "1".repeat(40),
  assigned = "0x" + "2".repeat(40),
  payer = "0x" + "3".repeat(40);
const ti = "0x" + "a".repeat(64),
  to = "0x" + "b".repeat(64),
  bh = "0x" + "c".repeat(64);
const transfer = (from: string, to: string, amount: number) => ({
  address: POLYGON_NATIVE_USDC,
  topics: [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x" + from.slice(2).padStart(64, "0"),
    "0x" + to.slice(2).padStart(64, "0"),
  ],
  data: "0x" + amount.toString(16).padStart(64, "0"),
  logIndex: "0x1",
  removed: false,
});
function setup() {
  const incoming = {
    transactionHash: ti,
    status: "0x1",
    blockHash: bh,
    blockNumber: "0x10",
    logs: [transfer(payer, assigned, 10000000)],
  };
  const outgoing = {
    transactionHash: to,
    status: "0x1",
    blockHash: bh,
    blockNumber: "0x11",
    logs: [transfer(assigned, merchant, 8300000)],
  };
  const state = {
    chain: "0x89",
    final: { number: "0x12" },
    block: { hash: bh, timestamp: "0x3e8" },
  };
  const callback = {
    address_in: assigned,
    coin: "polygon_usdc",
    value_coin: "10",
    txid_in: ti,
    txid_out: to,
  };
  const rpc = vi.fn(async (method: string, params: unknown[]) =>
    method === "eth_chainId"
      ? state.chain
      : method === "eth_getTransactionReceipt"
        ? params[0] === ti
          ? incoming
          : outgoing
        : params[0] === "finalized"
          ? state.final
          : state.block
  );
  const check = () =>
    verifyRiskPayManualReceipt({
      rpc,
      callback,
      assignedAddress: assigned,
      merchantAddress: merchant,
      createdAt: 999000,
    });
  return { incoming, outgoing, state, callback, rpc, check };
}
it("proves exact chain receipt without fabricating a fiat quote or claiming full payment", async () => {
  const s = setup(),
    r = await s.check();
  expect(r).toMatchObject({
    claim: `0x89:${to}:0x1`,
    incomingMicroUsdc: "10000000",
    merchantMicroUsdc: "8300000",
    token: POLYGON_NATIVE_USDC,
    receivedAt: 1000000,
  });
  expect(r).not.toHaveProperty("paid");
  expect(r).not.toHaveProperty("quote");
  expect(s.rpc.mock.calls.some(([m]) => /send/i.test(m))).toBe(false);
});
it.each([
  "chain",
  "finality",
  "reorg",
  "failed",
  "token",
  "sender",
  "recipient",
  "incoming",
  "callback_amount",
  "zero",
  "overpayment_to_merchant",
  "removed",
  "duplicate",
  "old",
  "wrong_order",
  "missing",
])("rejects %s evidence before owner acceptance", async kind => {
  const s = setup();
  if (kind === "chain") s.state.chain = "0x1";
  if (kind === "finality") s.state.final.number = "0xf";
  if (kind === "reorg") s.state.block.hash = "0x" + "d".repeat(64);
  if (kind === "failed") s.outgoing.status = "0x0";
  if (kind === "token") s.outgoing.logs[0].address = payer;
  if (kind === "sender")
    s.outgoing.logs[0].topics[1] = "0x" + payer.slice(2).padStart(64, "0");
  if (kind === "recipient")
    s.outgoing.logs[0].topics[2] = s.outgoing.logs[0].topics[1];
  if (kind === "incoming")
    s.incoming.logs[0].data = "0x" + "0".repeat(63) + "1";
  if (kind === "callback_amount") s.callback.value_coin = "9.99";
  if (kind === "zero") s.outgoing.logs[0].data = "0x" + "0".repeat(64);
  if (kind === "overpayment_to_merchant")
    s.outgoing.logs[0].data = "0x" + (11000000).toString(16).padStart(64, "0");
  if (kind === "removed") s.outgoing.logs[0].removed = true;
  if (kind === "duplicate")
    s.outgoing.logs.push({ ...s.outgoing.logs[0], logIndex: "0x2" });
  if (kind === "old") s.state.block.timestamp = "0x1";
  if (kind === "wrong_order") s.callback.address_in = payer;
  if (kind === "missing") s.outgoing.logs = [];
  await expect(s.check()).rejects.toThrow();
});
function order() {
  const row: any = {
    id: 7,
    name: "Synthetic client",
    email: "client@example.test",
    birthDate: "1990-01-01",
    birthTime: "12:00",
    birthCity: "Berlin",
    birthCountry: "Germany",
    language: "Русский",
    packageCode: "vedic_basic",
    packageVersion: 1,
    addon: 0,
    totalUsd: 9.99,
    currency: "USD",
    priceSnapshotJson: JSON.stringify({
      reading: { product: "vedic_basic", currentZone: "Europe/Berlin" },
    }),
  };
  const card: any = {
    identityHash: manualDigest(manualOrderIdentity(row)),
    receipt: { claim: "receipt-one" },
    preparation: { claim: "receipt-one" },
    delivery: { versionId: 2, pdfSha256: "a".repeat(64), email: row.email },
  };
  row.priceSnapshotJson = JSON.stringify({
    ...JSON.parse(row.priceSnapshotJson),
    riskpayManual: card,
  });
  return {
    row,
    card,
    save: () =>
      (row.priceSnapshotJson = JSON.stringify({
        reading: { product: "vedic_basic", currentZone: "Europe/Berlin" },
        riskpayManual: card,
      })),
  };
}
it.each([
  "email",
  "name",
  "birthDate",
  "birthTime",
  "birthCity",
  "birthCountry",
  "language",
  "packageCode",
  "totalUsd",
  "currency",
])("blocks changed %s at preparation and delivery", field => {
  const { row } = order();
  row[field] = "changed";
  expect(() => assertManualOrderUnchanged(row)).toThrow("changed");
  expect(() => assertManualFulfillment(row)).toThrow("changed");
});
it("requires receipt acceptance for generation and exact version/hash/recipient for delivery", () => {
  const s = order();
  expect(() =>
    assertManualFulfillment(s.row, { versionId: 2, pdfSha256: "a".repeat(64) })
  ).not.toThrow();
  expect(() =>
    assertManualFulfillment(s.row, { versionId: 3, pdfSha256: "a".repeat(64) })
  ).toThrow("version");
  expect(() =>
    assertManualFulfillment(s.row, { versionId: 2, pdfSha256: "b".repeat(64) })
  ).toThrow("version");
  s.card.preparation.claim = "other";
  s.save();
  expect(() => assertManualFulfillment(s.row)).toThrow("acceptance");
});
it("does not gate existing non-RiskPay orders", () =>
  expect(() =>
    assertManualFulfillment({ priceSnapshotJson: "{}" })
  ).not.toThrow());
it("live mode needs explicit owner-review configuration; sandbox flags never enable it", () => {
  const env = {
    DEPLOYMENT_MODE: "independent",
    RISKPAY_LIVE_ENABLED: "true",
    RISKPAY_FULFILLMENT: "owner_review",
    PUBLIC_BASE_URL: "https://example.test",
    RISKPAY_POLYGON_RPC_URL: "https://polygon.example.test",
    RISKPAY_MERCHANT_WALLET: merchant,
  };
  expect(riskPayManualEnabled(env)).toBe(true);
  for (const patch of [
    { RISKPAY_FULFILLMENT: "automatic" },
    { DEPLOYMENT_MODE: "sandbox" },
    { RISKPAY_LIVE_ENABLED: "false" },
    { PUBLIC_BASE_URL: "http://example.test" },
    { RISKPAY_MERCHANT_WALLET: "0x" + "0".repeat(40) },
    { RISKPAY_POLYGON_RPC_URL: "http://rpc.test" },
  ])
    expect(riskPayManualEnabled({ ...env, ...patch })).toBe(false);
});
