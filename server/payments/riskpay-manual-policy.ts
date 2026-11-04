import { createHash } from "node:crypto";
import {
  POLYGON_NATIVE_USDC,
  riskPayCallbackSchema,
  usdcMicroUnits,
} from "./riskpay-settlement";
import type { PolygonRpc } from "./riskpay-chain";

const TRANSFER =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const manualDigest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Fields shown to the owner, frozen at checkout and checked again at every step. */
export function manualOrderIdentity(row: any) {
  const price = JSON.parse(row.priceSnapshotJson || "{}");
  return {
    bookingId: row.id,
    name: row.name,
    email: row.email.trim().toLowerCase(),
    birthDate: row.birthDate,
    birthTime: row.birthTime,
    birthCity: row.birthCity,
    birthCountry: row.birthCountry,
    language: row.language,
    packageCode: row.packageCode,
    packageVersion: row.packageVersion,
    addon: row.addon,
    totalUsd: String(row.totalUsd),
    currency: row.currency,
    reading: price.reading || null,
  };
}
export function assertManualOrderUnchanged(row: any) {
  const card = JSON.parse(row.priceSnapshotJson || "{}").riskpayManual;
  if (card && manualDigest(manualOrderIdentity(row)) !== card.identityHash)
    throw Error(
      "Order details changed. Payment, recipient and birth details require a new review."
    );
  return card;
}
export function assertManualFulfillment(
  row: any,
  delivery?: { versionId: number; pdfSha256: string | null }
) {
  const card = assertManualOrderUnchanged(row);
  if (!card) return;
  if (
    !card.receipt ||
    !card.preparation ||
    card.preparation.claim !== card.receipt.claim
  )
    throw Error(
      "Owner payment acceptance is required before preparing this report."
    );
  if (
    delivery &&
    (!card.delivery ||
      card.delivery.versionId !== delivery.versionId ||
      card.delivery.pdfSha256 !== delivery.pdfSha256 ||
      card.delivery.email !== row.email.trim().toLowerCase())
  )
    throw Error(
      "Review this PDF version and its recipient in the RiskPay owner queue before sending."
    );
}
export function riskPayManualEnabled(env: NodeJS.ProcessEnv = process.env) {
  try {
    const base = new URL(env.PUBLIC_BASE_URL || "");
    const rpc = new URL(env.RISKPAY_POLYGON_RPC_URL || "");
    return (
      env.DEPLOYMENT_MODE === "independent" &&
      env.RISKPAY_LIVE_ENABLED === "true" &&
      env.RISKPAY_FULFILLMENT === "owner_review" &&
      base.protocol === "https:" &&
      !base.username &&
      !base.password &&
      base.pathname === "/" &&
      !base.search &&
      !base.hash &&
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
      rpc.protocol === "https:" &&
      !rpc.username &&
      !rpc.password &&
      /^0x(?!0{40}$)[a-f0-9]{40}$/i.test(env.RISKPAY_MERCHANT_WALLET || "")
    );
  } catch {
    return false;
  }
}

/** Proves a real receipt, NOT full fiat payment. Only an owner's explicit decision
 * can accept this amount for fulfillment; there is deliberately no invented quote. */
export async function verifyRiskPayManualReceipt(input: {
  rpc: PolygonRpc;
  callback: unknown;
  assignedAddress: string;
  merchantAddress: string;
  createdAt: number;
}) {
  const event = riskPayCallbackSchema.parse(input.callback);
  if (event.address_in.toLowerCase() !== input.assignedAddress.toLowerCase())
    throw Error("Wrong order wallet");
  if ((await input.rpc("eth_chainId", [])) !== "0x89")
    throw Error("Wrong chain");
  const final = await input.rpc("eth_getBlockByNumber", ["finalized", false]);
  if (!/^0x[a-f0-9]+$/i.test(final?.number))
    throw Error("Finality unavailable");
  const read = async (hash: string) => {
    const r = await input.rpc("eth_getTransactionReceipt", [hash]);
    if (
      !r ||
      r.status !== "0x1" ||
      r.transactionHash?.toLowerCase() !== hash.toLowerCase() ||
      !/^0x[a-f0-9]+$/i.test(r.blockNumber) ||
      BigInt(r.blockNumber) > BigInt(final.number)
    )
      throw Error("Receipt not final");
    const b = await input.rpc("eth_getBlockByNumber", [r.blockNumber, false]);
    if (
      !/^0x[a-f0-9]{64}$/i.test(b?.hash) ||
      r.blockHash?.toLowerCase() !== b.hash.toLowerCase() ||
      !/^0x[a-f0-9]+$/i.test(b.timestamp)
    )
      throw Error("Noncanonical receipt");
    const at = Number(BigInt(b.timestamp)) * 1000;
    if (
      !Number.isSafeInteger(at) ||
      at < input.createdAt - 120000 ||
      at > Date.now() + 120000
    )
      throw Error("Receipt predates order");
    return { r, at };
  };
  const incoming = await read(event.txid_in),
    outgoing = await read(event.txid_out);
  if (outgoing.at < incoming.at) throw Error("Invalid receipt order");
  const transfers = (r: any, to: string, from?: string) =>
    (r.logs || []).filter(
      (l: any) =>
        !l.removed &&
        l.address?.toLowerCase() === POLYGON_NATIVE_USDC &&
        l.topics?.length === 3 &&
        l.topics[0]?.toLowerCase() === TRANSFER &&
        /^0x0{24}[a-f0-9]{40}$/i.test(l.topics[1]) &&
        /^0x0{24}[a-f0-9]{40}$/i.test(l.topics[2]) &&
        l.topics[2].slice(-40).toLowerCase() === to.slice(2).toLowerCase() &&
        (!from ||
          l.topics[1].slice(-40).toLowerCase() ===
            from.slice(2).toLowerCase()) &&
        /^0x[a-f0-9]{64}$/i.test(l.data) &&
        /^0x[a-f0-9]+$/i.test(l.logIndex)
    );
  const ins = transfers(incoming.r, input.assignedAddress),
    outs = transfers(outgoing.r, input.merchantAddress, input.assignedAddress);
  if (ins.length !== 1 || outs.length !== 1)
    throw Error("Ambiguous or missing USDC transfer");
  const gross = BigInt(ins[0].data),
    net = BigInt(outs[0].data);
  if (
    gross <= BigInt(0) ||
    gross.toString() !== usdcMicroUnits(event.value_coin) ||
    net <= BigInt(0) ||
    net > gross ||
    net > BigInt("999999999999999999")
  )
    throw Error("Invalid transfer amount");
  return {
    claim: `0x89:${event.txid_out.toLowerCase()}:0x${BigInt(outs[0].logIndex).toString(16)}`,
    incomingMicroUsdc: gross.toString(),
    merchantMicroUsdc: net.toString(),
    txidIn: event.txid_in.toLowerCase(),
    txidOut: event.txid_out.toLowerCase(),
    receivedAt: outgoing.at,
    token: POLYGON_NATIVE_USDC,
    chainId: "0x89",
  };
}
