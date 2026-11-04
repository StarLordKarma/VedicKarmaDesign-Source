import { z } from "zod";
import { POLYGON_NATIVE_USDC } from "./riskpay-settlement";
import type { PolygonRpc } from "./riskpay-chain";
const address = z
  .string()
  .regex(/^0x[0-9a-f]{40}$/i)
  .refine(v => !/^0x0{40}$/i.test(v));
const hex = z.string().regex(/^0x[0-9a-f]+$/i);
const txHash = z.string().regex(/^0x[0-9a-f]{64}$/i);
const intentSchema = z.object({
  quoteId: z.string().uuid(),
  merchant: address,
  recipient: address,
  netMicroUsdc: z.string().regex(/^[1-9]\d{0,17}$/),
  acceptedAt: z.number().int().positive().safe(),
  // Must be captured independently and persisted when the buyer accepts.
  startBlock: hex,
});
export type RiskPayRefundIntent = z.infer<typeof intentSchema>;
/** Verifies only; does not send funds, mark an order refunded, or reserve a DB
 * claim. The caller must atomically claim the returned log before changing state. */
export async function verifyRiskPayRefund(input: {
  rpc: PolygonRpc;
  intent: RiskPayRefundIntent;
  transactionHash: string;
}) {
  const intent = intentSchema.parse(input.intent),
    hash = txHash.parse(input.transactionHash).toLowerCase();
  const review = (reason: string) => ({
    status: "under_review" as const,
    reason,
  });
  if (intent.merchant.toLowerCase() === intent.recipient.toLowerCase())
    return review("self_transfer");
  if ((await input.rpc("eth_chainId", [])) !== "0x89")
    return review("wrong_chain");
  const finalized = await input.rpc("eth_getBlockByNumber", [
    "finalized",
    false,
  ]);
  if (!hex.safeParse(finalized?.number).success)
    return review("missing_finality");
  const receipt = await input.rpc("eth_getTransactionReceipt", [hash]);
  if (!receipt || !hex.safeParse(receipt.blockNumber).success)
    return review("not_mined");
  if (
    receipt.status !== "0x1" ||
    receipt.transactionHash?.toLowerCase() !== hash
  )
    return review("failed_or_wrong_transaction");
  if (BigInt(receipt.blockNumber) > BigInt(finalized.number))
    return review("not_final");
  if (BigInt(receipt.blockNumber) <= BigInt(intent.startBlock))
    return review("predates_refund_acceptance");
  const block = await input.rpc("eth_getBlockByNumber", [
    receipt.blockNumber,
    false,
  ]);
  if (
    !txHash.safeParse(block?.hash).success ||
    !txHash.safeParse(receipt.blockHash).success ||
    block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()
  )
    return review("noncanonical_block");
  if (
    !hex.safeParse(block.timestamp).success ||
    BigInt(block.timestamp) < BigInt(Math.floor(intent.acceptedAt / 1000))
  )
    return review("predates_refund_acceptance");
  const topic =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const matches = (Array.isArray(receipt.logs) ? receipt.logs : []).filter(
    (log: any) =>
      !log.removed &&
      log.address?.toLowerCase() === POLYGON_NATIVE_USDC &&
      Array.isArray(log.topics) &&
      log.topics.length === 3 &&
      log.topics[0]?.toLowerCase() === topic &&
      /^0x0{24}[0-9a-f]{40}$/i.test(log.topics[1]) &&
      /^0x0{24}[0-9a-f]{40}$/i.test(log.topics[2]) &&
      log.topics[1].slice(-40).toLowerCase() ===
        intent.merchant.slice(2).toLowerCase() &&
      log.topics[2].slice(-40).toLowerCase() ===
        intent.recipient.slice(2).toLowerCase() &&
      /^0x[0-9a-f]{64}$/i.test(log.data) &&
      BigInt(log.data).toString() === intent.netMicroUsdc &&
      hex.safeParse(log.logIndex).success
  );
  if (matches.length !== 1) return review("refund_transfer_not_verified");
  return {
    status: "verified" as const,
    quoteId: intent.quoteId,
    transactionHash: hash,
    claim: `0x89:${hash}:0x${BigInt(matches[0].logIndex).toString(16)}`,
    netMicroUsdc: intent.netMicroUsdc,
    recipient: intent.recipient.toLowerCase(),
  };
}
