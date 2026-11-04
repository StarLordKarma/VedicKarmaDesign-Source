import { z } from "zod";
// Circle native USDC on Polygon. USDT0 and bridged USDC are not interchangeable.
export const POLYGON_NATIVE_USDC = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
const TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const riskPayCallbackSchema = z.object({
  value_coin: z.string().regex(/^\d+(\.\d{1,6})?$/),
  coin: z.literal("polygon_usdc"),
  txid_in: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  txid_out: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  address_in: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});
export type RiskPayCallback = z.infer<typeof riskPayCallbackSchema>;
export function usdcMicroUnits(value: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw Error("Invalid USDC value");
  const [a, b = ""] = value.split(".");
  return (BigInt(a) * BigInt(1000000) + BigInt(b.padEnd(6, "0"))).toString();
}
type Receipt = {
  transactionHash: string;
  status: string;
  blockNumber: string;
  blockHash: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    logIndex: string;
    removed?: boolean;
  }>;
};
type Evidence = {
  receipt: Receipt;
  canonicalBlockHash: string;
  blockTimestamp: number;
};
export function evaluateRiskPaySettlement(input: {
  callback: unknown;
  assignedAddress: string;
  merchantAddress: string;
  chainId: string;
  finalizedBlock: string;
  incoming: Evidence;
  outgoing: Evidence;
  quote?: {
    incomingMicroUsdc: string;
    merchantMicroUsdc: string;
    expiresAt: number;
  };
}) {
  const event = riskPayCallbackSchema.parse(input.callback);
  const review = (reason: string) => ({
    status: "under_review" as const,
    reason,
  });
  if (!input.quote) return review("missing_authoritative_settlement_quote");
  if (input.chainId !== "0x89") return review("wrong_chain");
  if (event.address_in.toLowerCase() !== input.assignedAddress.toLowerCase())
    return review("wrong_order_wallet");
  if (usdcMicroUnits(event.value_coin) !== input.quote.incomingMicroUsdc)
    return review("incoming_quote_mismatch");
  if (
    !/^[1-9]\d*$/.test(input.quote.incomingMicroUsdc) ||
    !/^[1-9]\d*$/.test(input.quote.merchantMicroUsdc)
  )
    return review("invalid_quote");
  if (
    !Number.isSafeInteger(input.incoming.blockTimestamp) ||
    !Number.isSafeInteger(input.outgoing.blockTimestamp) ||
    input.incoming.blockTimestamp <= 0 ||
    input.outgoing.blockTimestamp < input.incoming.blockTimestamp ||
    !Number.isSafeInteger(input.quote.expiresAt) ||
    input.quote.expiresAt <= 0 ||
    BigInt(input.quote.merchantMicroUsdc) >
      BigInt(input.quote.incomingMicroUsdc)
  )
    return review("invalid_evidence_order");
  const transfer = (
    proof: Evidence,
    hash: string,
    to: string,
    from: string | undefined,
    units: string
  ) => {
    const r = proof.receipt;
    if (
      r.transactionHash.toLowerCase() !== hash.toLowerCase() ||
      r.status !== "0x1" ||
      r.blockHash.toLowerCase() !== proof.canonicalBlockHash.toLowerCase() ||
      BigInt(r.blockNumber) > BigInt(input.finalizedBlock)
    )
      return undefined;
    const matches = r.logs.filter(
      l =>
        !l.removed &&
        l.address.toLowerCase() === POLYGON_NATIVE_USDC &&
        l.topics.length === 3 &&
        l.topics[0].toLowerCase() === TRANSFER &&
        /^0x0{24}[a-f0-9]{40}$/i.test(l.topics[1]) &&
        /^0x0{24}[a-f0-9]{40}$/i.test(l.topics[2]) &&
        l.topics[2].slice(-40).toLowerCase() === to.slice(2).toLowerCase() &&
        (!from ||
          l.topics[1].slice(-40).toLowerCase() ===
            from.slice(2).toLowerCase()) &&
        /^0x[a-f0-9]{64}$/i.test(l.data) &&
        BigInt(l.data).toString() === units &&
        /^0x[a-f0-9]+$/i.test(l.logIndex)
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  if (input.incoming.blockTimestamp > input.quote.expiresAt)
    return review("late_settlement");
  if (
    !transfer(
      input.incoming,
      event.txid_in,
      input.assignedAddress,
      undefined,
      input.quote.incomingMicroUsdc
    )
  )
    return review("incoming_transfer_not_verified");
  const out = transfer(
    input.outgoing,
    event.txid_out,
    input.merchantAddress,
    input.assignedAddress,
    input.quote.merchantMicroUsdc
  );
  if (!out) return review("merchant_receipt_not_verified");
  return {
    status: "verified" as const,
    claim: `0x89:${event.txid_out.toLowerCase()}:0x${BigInt(out.logIndex).toString(16)}`,
    merchantMicroUsdc: input.quote.merchantMicroUsdc,
  };
}
