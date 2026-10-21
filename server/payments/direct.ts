import { directQuoteRate } from "./direct-rates";
import { prepareTronIntent } from "./direct-tron";
import {
  PAYMENT_NETWORKS,
  isPaymentNetwork,
  type PaymentNetworkId,
} from "../../shared/payment-networks";
import { paymentRpcUrl, configuredPaymentNetworks } from "./direct-networks";
import { DEFAULT_DIRECT_WALLET } from "../../shared/direct-wallet";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { PaymentProvider } from "./provider";

// Native Tether USDt, Avalanche C-Chain. Never accept bridged USDT.e.
export const DIRECT_CHAIN = "0xa86a";
export const DIRECT_TOKEN = "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7";
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export type Intent = {
  bookingId: number;
  id: string;
  recipient: string;
  units: string;
  amount: string;
  startBlock: string;
  deadline: number;
  network?: PaymentNetworkId;
  bindingRequired?: boolean;
  tron?: { recipient: string; startBlock: number };
  options?: Array<{ network: PaymentNetworkId; startBlock: string }>;
};
function key() {
  if ((process.env.JWT_SECRET?.length ?? 0) < 32)
    throw new Error("Wallet payments require a strong JWT_SECRET");
  return new TextEncoder().encode(process.env.JWT_SECRET);
}
export async function rpc(
  method: string,
  params: unknown[] = [],
  network: PaymentNetworkId = "avalanche"
): Promise<any> {
  const url = paymentRpcUrl(network);
  if (!url || !url.startsWith("https://"))
    throw new Error("Wallet payment network is not configured");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error("Payment network unavailable; please retry");
  const body = await response.json();
  if (body.error)
    throw new Error("Payment network could not complete the check");
  return body.result;
}
export function transferData(intent: Intent) {
  // An order-specific trailing word is signed as part of the transaction.
  // ERC20 transfer decodes the first two arguments; this binds one transfer to one order.
  return `0xa9059cbb${intent.recipient.slice(2).toLowerCase().padStart(64, "0")}${BigInt(intent.units).toString(16).padStart(64, "0")}${intent.id}`;
}
export async function readIntent(token: string): Promise<Intent> {
  const { payload } = await jwtVerify(token, key(), {
    algorithms: ["HS256"],
    audience: "direct-payment",
    issuer: "vedic-karma",
  });
  const intent = payload.intent as Intent;
  if (
    !intent ||
    !Number.isSafeInteger(intent.bookingId) ||
    !/^[a-f0-9]{64}$/.test(intent.id)
  )
    throw new Error("Invalid payment link");
  if (
    intent.options &&
    ((!intent.options.length && !intent.tron) ||
      intent.options.some(
        o =>
          !isPaymentNetwork(o.network) || !/^0x[0-9a-f]+$/i.test(o.startBlock)
      ))
  )
    throw new Error("Invalid payment networks");
  return intent;
}
export function intentOptions(intent: Intent) {
  return (
    intent.options ?? [
      { network: "avalanche" as const, startBlock: intent.startBlock },
    ]
  );
}
export function selectIntentNetwork(
  intent: Intent,
  network: unknown = "avalanche"
): Intent {
  if (!isPaymentNetwork(network))
    throw new Error("Unsupported payment network");
  const option = intentOptions(intent).find(o => o.network === network);
  if (!option) throw new Error("Network was not offered for this invoice");
  const decimals = PAYMENT_NETWORKS[network].decimals;
  // BNB's Binance-Peg token has 18 decimals, unlike native USDT's 6.
  const units = (
    BigInt(intent.units) * BigInt("1" + "0".repeat(decimals - 6))
  ).toString();
  return { ...intent, network, startBlock: option.startBlock, units };
}
export const directPaymentProvider: PaymentProvider = {
  id: "direct",
  displayName: "MetaMask · USDT",
  webhookPath: "/api/direct-payment",
  async createPayment(input) {
    const recipient =
      process.env.DIRECT_WALLET_ADDRESS || DEFAULT_DIRECT_WALLET;
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || /^0x0{40}$/i.test(recipient))
      throw new Error("Receiving wallet is not configured");
    const currency = (input.priceCurrency || "USD").toUpperCase();
    const rate = await directQuoteRate(currency);
    if (!Number.isFinite(rate) || rate <= 0)
      throw new Error(`USDT quote unavailable for ${currency}`);
    const cents = Math.round(input.priceAmount * rate * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0)
      throw new Error("Invalid USDT amount");
    const prepared = await Promise.allSettled(
      configuredPaymentNetworks().map(async network => {
        if (
          (await rpc("eth_chainId", [], network)) !==
          PAYMENT_NETWORKS[network].chainId
        )
          throw new Error("Wrong RPC network");
        const startBlock = await rpc("eth_blockNumber", [], network);
        if (!/^0x[0-9a-f]+$/i.test(startBlock))
          throw new Error("Invalid starting block");
        return { network, startBlock };
      })
    );
    const options = prepared.flatMap(r =>
      r.status === "fulfilled" ? [r.value] : []
    );
    const tron = await prepareTronIntent().catch(() => undefined);
    if (!options.length && !tron)
      throw new Error("No payment network is currently available");
    const intent: Intent = {
      bookingId: Number(input.orderId.replace("booking-", "")),
      id: randomBytes(32).toString("hex"),
      recipient,
      units: (BigInt(cents) * BigInt(10000)).toString(),
      amount: (cents / 100).toFixed(2),
      startBlock: options[0]?.startBlock ?? "0x0",
      tron,
      options,
      bindingRequired: true,
      deadline: Math.floor(Date.now() / 1000) + 1800,
    };
    // Link remains usable for recovery; payment eligibility uses the mined block timestamp.
    const token = await new SignJWT({ intent })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("vedic-karma")
      .setAudience("direct-payment")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key());
    return {
      id: intent.id,
      invoice_url: `${new URL(input.successUrl).origin}/pay/${token}`,
      price_amount: input.priceAmount,
      price_currency: currency,
    };
  },
  verifyWebhook: () => false,
  normalizeStatus: status => (status === "confirmed" ? "paid" : "pending"),
  isPaid: status => status === "confirmed" || status === "finished",
};

export class LatePaymentError extends Error {}

export async function verifyTransfer(
  intent: Intent,
  hash: string,
  expectedPayer?: string
) {
  const network = intent.network ?? "avalanche";
  // A caller cannot select a network absent from the signed invoice.
  if (!intentOptions(intent).some(o => o.network === network))
    throw new Error("Network was not offered for this invoice");
  const config = PAYMENT_NETWORKS[network];
  const call = (method: string, params: unknown[] = []) =>
    rpc(method, params, network);
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error("Invalid transaction hash");
  if ((await call("eth_chainId")) !== config.chainId)
    throw new Error("Wrong payment network");
  const receipt = await call("eth_getTransactionReceipt", [hash]);
  if (!receipt) return false;
  if (receipt.status !== "0x1")
    throw new Error("Transaction failed. No payment was accepted");
  const tx = await call("eth_getTransactionByHash", [hash]);
  if (
    !tx ||
    (expectedPayer !== undefined &&
      tx.from?.toLowerCase() !== expectedPayer.toLowerCase()) ||
    tx.to?.toLowerCase() !== config.token ||
    tx.input?.toLowerCase() !== transferData(intent) ||
    BigInt(tx.value) !== BigInt(0)
  )
    throw new Error("Transaction does not match this order");
  const block = await call("eth_getBlockByNumber", [
    receipt.blockNumber,
    false,
  ]);
  if (
    !block ||
    block.hash !== receipt.blockHash ||
    BigInt(receipt.blockNumber) < BigInt(intent.startBlock)
  )
    throw new Error("Payment is outside this invoice window; contact support");
  const finalized = await call("eth_getBlockByNumber", ["finalized", false]);
  if (!finalized || BigInt(finalized.number) < BigInt(receipt.blockNumber))
    return false;
  const paid = receipt.logs.some(
    (log: any) =>
      log.address?.toLowerCase() === config.token &&
      log.topics?.[0] === TRANSFER_TOPIC &&
      log.topics?.[1]?.toLowerCase() ===
        `0x${tx.from.slice(2).toLowerCase().padStart(64, "0")}` &&
      log.topics?.[2]?.toLowerCase() ===
        `0x${intent.recipient.slice(2).toLowerCase().padStart(64, "0")}` &&
      BigInt(log.data) === BigInt(intent.units)
  );
  if (!paid) throw new Error("USDT transfer was not received");
  if (Number(BigInt(block.timestamp)) > intent.deadline)
    throw new LatePaymentError(
      "Payment is outside this invoice window; contact support"
    );
  return true;
}
