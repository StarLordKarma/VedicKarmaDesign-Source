import { createHash } from "node:crypto";
import { POLYGON_NATIVE_USDC } from "./riskpay-settlement";
import type { PolygonRpc } from "./riskpay-chain";
import type { RiskPayRefundIntent } from "./riskpay-refund-proof";
/** Explicit OFFLINE test evidence. Never broadcasts a transfer or calls RPC. */
export function riskPayRefundFixture(
  intent: RiskPayRefundIntent,
  sessionId: string
) {
  const hash =
    "0x" +
    createHash("sha256")
      .update("fixture-refund:" + sessionId + ":" + intent.quoteId)
      .digest("hex");
  const blockHash =
    "0x" +
    createHash("sha256")
      .update("fixture-block:" + hash)
      .digest("hex");
  const number = "0x" + (BigInt(intent.startBlock) + BigInt(1)).toString(16);
  const rpc: PolygonRpc = async (method, params) => {
    if (method === "eth_chainId") return "0x89";
    if (method === "eth_getBlockByNumber" && params[0] === "finalized")
      return { number };
    if (method === "eth_getBlockByNumber" && params[0] === number)
      return {
        hash: blockHash,
        timestamp:
          "0x" + BigInt(Math.ceil(intent.acceptedAt / 1000)).toString(16),
      };
    if (method === "eth_getTransactionReceipt" && params[0] === hash)
      return {
        transactionHash: hash,
        status: "0x1",
        blockNumber: number,
        blockHash,
        logs: [
          {
            address: POLYGON_NATIVE_USDC,
            removed: false,
            logIndex: "0x0",
            topics: [
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
              "0x" + intent.merchant.slice(2).toLowerCase().padStart(64, "0"),
              "0x" + intent.recipient.slice(2).toLowerCase().padStart(64, "0"),
            ],
            data:
              "0x" + BigInt(intent.netMicroUsdc).toString(16).padStart(64, "0"),
          },
        ],
      };
    throw Error("Unexpected offline refund verification request");
  };
  return { hash, rpc };
}
