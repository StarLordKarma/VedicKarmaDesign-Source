import { expect, it, vi } from "vitest";
import { verifyRiskPayRefund } from "./riskpay-refund-proof";
import { POLYGON_NATIVE_USDC } from "./riskpay-settlement";
import { riskPayRefundFixture } from "./riskpay-refund-fixture";
const merchant = "0x" + "1".repeat(40),
  recipient = "0x" + "2".repeat(40),
  hash = "0x" + "a".repeat(64),
  blockHash = "0x" + "b".repeat(64);
function setup() {
  const intent = {
    quoteId: "12345678-1234-4123-8123-123456789abc",
    merchant,
    recipient,
    netMicroUsdc: "3982000",
    acceptedAt: 999000,
    startBlock: "0x10",
  };
  const log = {
    address: POLYGON_NATIVE_USDC,
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x" + merchant.slice(2).padStart(64, "0"),
      "0x" + recipient.slice(2).padStart(64, "0"),
    ],
    data: "0x" + BigInt(intent.netMicroUsdc).toString(16).padStart(64, "0"),
    logIndex: "0x0001",
    removed: false,
  };
  const receipt = {
    status: "0x1",
    transactionHash: hash,
    blockHash,
    blockNumber: "0x11",
    logs: [log],
  };
  const block = { hash: blockHash, timestamp: "0x3e8" },
    finalized = { number: "0x12" };
  const state = { chain: "0x89", receipt, block, finalized };
  const rpc = vi.fn(async (method: string, params: unknown[]) =>
    method === "eth_chainId"
      ? state.chain
      : method === "eth_getTransactionReceipt"
        ? state.receipt
        : params[0] === "finalized"
          ? state.finalized
          : state.block
  );
  const check = () =>
    verifyRiskPayRefund({ rpc, intent, transactionHash: hash });
  return { intent, receipt, block, finalized, state, log, rpc, check };
}
it("verifies the exact accepted refund and returns one normalized claim without sending funds", async () => {
  const s = setup();
  expect(await s.check()).toEqual({
    status: "verified",
    quoteId: s.intent.quoteId,
    transactionHash: hash,
    claim: `0x89:${hash}:0x1`,
    netMicroUsdc: "3982000",
    recipient,
  });
  expect(s.rpc.mock.calls.some(([method]) => /send/i.test(method))).toBe(false);
});
it.each([
  "chain",
  "pending",
  "failed",
  "reorg",
  "token",
  "sender",
  "recipient",
  "amount",
  "duplicate",
  "removed",
  "old_block",
  "old_time",
  "self",
])("does not confirm %s evidence", async kind => {
  const s = setup();
  if (kind === "chain") s.state.chain = "0x1";
  if (kind === "pending") s.finalized.number = "0x10";
  if (kind === "failed") s.receipt.status = "0x0";
  if (kind === "reorg") s.block.hash = "0x" + "c".repeat(64);
  if (kind === "token") s.log.address = "0x" + "3".repeat(40);
  if (kind === "sender") s.log.topics[1] = s.log.topics[2];
  if (kind === "recipient") s.log.topics[2] = s.log.topics[1];
  if (kind === "amount") s.log.data = "0x" + "0".repeat(63) + "1";
  if (kind === "duplicate") s.receipt.logs.push({ ...s.log, logIndex: "0x2" });
  if (kind === "removed") s.log.removed = true;
  if (kind === "old_block") s.intent.startBlock = "0x11";
  if (kind === "old_time") s.block.timestamp = "0x1";
  if (kind === "self") s.intent.recipient = s.intent.merchant;
  expect(await s.check()).toMatchObject({ status: "under_review" });
});
it("fails closed for invalid intent and unavailable RPC", async () => {
  const s = setup();
  s.intent.netMicroUsdc = "0";
  await expect(s.check()).rejects.toThrow();
  expect(s.rpc).not.toHaveBeenCalled();
  const t = setup();
  t.rpc.mockRejectedValueOnce(Error("offline"));
  await expect(t.check()).rejects.toThrow("offline");
});
it("runs deterministic offline evidence through the same verifier and distinguishes sessions", async () => {
  const { intent } = setup();
  const a = riskPayRefundFixture(intent, "session-a"),
    b = riskPayRefundFixture(intent, "session-b");
  expect(a.hash).not.toBe(b.hash);
  expect(
    (await verifyRiskPayRefund({ rpc: a.rpc, intent, transactionHash: a.hash }))
      .status
  ).toBe("verified");
  await expect(a.rpc("eth_sendTransaction", [])).rejects.toThrow(
    "Unexpected offline"
  );
  await expect(a.rpc("eth_getTransactionReceipt", [b.hash])).rejects.toThrow(
    "Unexpected offline"
  );
});
