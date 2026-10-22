import { randomBytes } from "node:crypto";
import { compactVerify } from "jose";
import { orderSigningKey } from "./payments/order-signing";
import { isPaymentNetwork, PAYMENT_NETWORKS, type CheckoutNetworkId } from "../shared/payment-networks";
import { isPaidPaymentStatus } from "../shared/payment-status";
import { TRON_PAYMENT } from "../shared/tron-payment";
import { rpc, selectIntentNetwork, verifyTransfer, LatePaymentError, type Intent } from "./payments/direct";
import { assertTronMainnet, tronApi, verifyTronTransfer, TronLatePaymentError } from "./payments/direct-tron";

export function isRefundHeld(status: string | null | undefined) { return status === "refund_pending" || status === "refunded"; }
export function refundPaymentHash(paymentId: string | null, network: CheckoutNetworkId) {
  const chain = network === "tron" ? TRON_PAYMENT.chainId : PAYMENT_NETWORKS[network].chainId;
  if (!paymentId?.startsWith(`${chain}:`)) throw new Error("Payment network does not match the recorded receipt");
  const hash = paymentId.slice(chain.length + 1);
  if (!(network === "tron" ? /^[a-f0-9]{64}$/i : /^0x[a-f0-9]{64}$/i).test(hash)) throw new Error("Recorded payment hash is invalid");
  return hash.toLowerCase();
}
export function checkedRefundNetwork(network: string): CheckoutNetworkId {
  if (network !== "tron" && !isPaymentNetwork(network)) throw new Error("Unsupported refund network");
  return network;
}
export async function verifyRefundTransfer(intent: Intent, network: CheckoutNetworkId, merchant: string, hash: string) {
  return network === "tron" ? verifyTronTransfer(intent, hash, merchant) : verifyTransfer(intent, hash, merchant);
}

export async function prepareVerifiedRefund(booking: { id: number; paymentUrl: string | null; paymentId: string | null; paymentStatus: string | null }, binding: { network: string; payer: string; intentId: string } | undefined) {
  if ((!isPaidPaymentStatus(booking.paymentStatus) && booking.paymentStatus !== "manual_review") || !binding) throw new Error("Only an independently verified payment can be refunded");
  const token = booking.paymentUrl?.split("/pay/")[1];
  if (!token) throw new Error("Direct payment invoice is required");
  // The checkout URL may have expired; a refund still requires its valid signature.
  const signed = await compactVerify(token, orderSigningKey(), { algorithms: ["HS256"] });
  const payload = JSON.parse(new TextDecoder().decode(signed.payload));
  if (payload.iss !== "vedic-karma" || payload.aud !== "direct-payment") throw new Error("Invalid archived invoice");
  const original: Intent = payload.intent;
  if (!original || !/^[a-f0-9]{64}$/.test(original.id)) throw new Error("Invalid archived invoice");
  if (original.bookingId !== booking.id || original.id !== binding.intentId) throw new Error("Payment binding does not match this order");
  const network = checkedRefundNetwork(binding.network);
  const incoming = network === "tron" ? original : selectIntentNetwork(original, network);
  const incomingHash = refundPaymentHash(booking.paymentId, network);
  try {
    if (!await verifyRefundTransfer(incoming, network, binding.payer, incomingHash)) throw new Error("Original payment is not final yet");
  } catch (error) {
    // Late but fully verified incoming transfers may be returned too.
    if (!(error instanceof LatePaymentError) && !(error instanceof TronLatePaymentError)) throw error;
  }
  const intent: Intent = { ...incoming, id: randomBytes(32).toString("hex"), deadline: Number.MAX_SAFE_INTEGER, bindingRequired: false };
  let merchant: string;
  if (network === "tron") {
    if (!original.tron) throw new Error("TRON invoice is missing");
    await assertTronMainnet();
    const block = await tronApi("wallet/getnowblock");
    const startBlock = block.block_header?.raw_data?.number;
    if (!Number.isSafeInteger(startBlock)) throw new Error("Invalid refund starting block");
    merchant = original.tron.recipient;
    intent.tron = { recipient: binding.payer, startBlock };
  } else {
    if (await rpc("eth_chainId", [], network) !== PAYMENT_NETWORKS[network].chainId) throw new Error("Wrong refund network");
    const startBlock = await rpc("eth_blockNumber", [], network);
    if (!/^0x[a-f0-9]+$/i.test(startBlock)) throw new Error("Invalid refund starting block");
    merchant = original.recipient;
    intent.recipient = binding.payer;
    intent.startBlock = startBlock;
    intent.options = [{ network, startBlock }];
  }
  return { intent, merchant, network, recipient: binding.payer, amount: original.amount };
}
