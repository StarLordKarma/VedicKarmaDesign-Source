import {
  evaluateRiskPaySettlement,
  type RiskPayCallback,
} from "./riskpay-settlement";
export type PolygonRpc = (method: string, params: unknown[]) => Promise<any>;
export function riskPayPolygonRpc(
  endpoint: string,
  fetcher: typeof fetch = fetch
): PolygonRpc {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error(
      "Independent Polygon RPC requires HTTPS without URL credentials"
    );
  return async (method, params) => {
    const response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error("Polygon verification unavailable");
    const raw = await response.text();
    if (raw.length > 1048576)
      throw Error("Polygon response exceeds verification limit");
    const body = JSON.parse(raw);
    if (body.error || body.result === undefined)
      throw Error("Polygon verification unavailable");
    return body.result;
  };
}
export async function verifyRiskPayOnChain(input: {
  rpc: PolygonRpc;
  callback: RiskPayCallback;
  assignedAddress: string;
  merchantAddress: string;
  quote: {
    incomingMicroUsdc: string;
    merchantMicroUsdc: string;
    expiresAt: number;
  };
}) {
  const chainId = await input.rpc("eth_chainId", []);
  if (chainId !== "0x89") throw Error("Wrong Polygon RPC chain");
  const finalized = await input.rpc("eth_getBlockByNumber", [
    "finalized",
    false,
  ]);
  if (!/^0x[0-9a-f]+$/i.test(finalized?.number))
    throw Error("Polygon finalized block unavailable");
  const receipt = async (hash: string) => {
    const r = await input.rpc("eth_getTransactionReceipt", [hash]);
    if (!r || !/^0x[0-9a-f]+$/i.test(r.blockNumber))
      throw Error("Settlement transaction not mined");
    const block = await input.rpc("eth_getBlockByNumber", [
      r.blockNumber,
      false,
    ]);
    if (
      !/^0x[0-9a-f]{64}$/i.test(block?.hash) ||
      !/^0x[0-9a-f]+$/i.test(block?.timestamp)
    )
      throw Error("Canonical block unavailable");
    return {
      receipt: r,
      canonicalBlockHash: block.hash,
      blockTimestamp: Number(BigInt(block.timestamp)),
    };
  };
  const incoming = await receipt(input.callback.txid_in),
    outgoing = await receipt(input.callback.txid_out);
  return evaluateRiskPaySettlement({
    ...input,
    chainId,
    finalizedBlock: finalized.number,
    incoming,
    outgoing,
  });
}
