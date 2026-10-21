import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { verifyMessage } from "ethers";
import { Trx } from "tronweb";
import { and, eq, isNull } from "drizzle-orm";
import { directPaymentBindings } from "../../drizzle/schema";
import { getDb } from "../db";
import { createClientStatusLink } from "../client-status";
import {
  PAYMENT_NETWORKS,
  isPaymentNetwork,
  type CheckoutNetworkId,
} from "../../shared/payment-networks";
import { TRON_PAYMENT } from "../../shared/tron-payment";
import { tronAddressHex } from "./direct-tron";
import type { Intent } from "./direct";

type Challenge = {
  intentId: string;
  bookingId: number;
  network: CheckoutNetworkId;
  payer: string;
  nonce: string;
  message: string;
};
function secret() {
  if ((process.env.JWT_SECRET?.length ?? 0) < 32)
    throw new Error("Strong signing secret required");
  return new TextEncoder().encode(process.env.JWT_SECRET);
}
export function validateNetworkChoice(
  intent: Intent,
  network: unknown
): asserts network is CheckoutNetworkId {
  if (
    network === "tron"
      ? !intent.tron
      : !isPaymentNetwork(network) ||
        !(intent.options ?? [{ network: "avalanche" }]).some(
          o => o.network === network
        )
  )
    throw new Error("Network not offered");
}
function normalizePayer(network: CheckoutNetworkId, address: string) {
  if (network === "tron") {
    tronAddressHex(address);
    return address;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address))
    throw new Error("Invalid payer address");
  return address.toLowerCase();
}
export async function createWalletChallenge(
  intent: Intent,
  network: unknown,
  address: string,
  origin: string
) {
  validateNetworkChoice(intent, network);
  if (Date.now() / 1000 >= intent.deadline) throw new Error("Invoice expired");
  const payer = normalizePayer(network, address),
    nonce = randomBytes(24).toString("hex");
  const config = network === "tron" ? TRON_PAYMENT : PAYMENT_NETWORKS[network];
  const recipient =
    network === "tron" ? intent.tron!.recipient : intent.recipient;
  const message = [
    "Vedic Karma Design — confirm payment wallet",
    `Site: ${origin}`,
    `Order: ${intent.bookingId}`,
    `Invoice: ${intent.id}`,
    `Network: ${config.name} (${config.chainId})`,
    `Payer: ${payer}`,
    `Recipient: ${recipient}`,
    `Amount: ${intent.amount} ${config.tokenSymbol}`,
    `Token contract: ${config.token}`,
    `Pay before: ${new Date(intent.deadline * 1000).toISOString()}`,
    `Nonce: ${nonce}`,
    "This signature only links your wallet to this order. It does not authorize token spending.",
  ].join("\n");
  const challenge: Challenge = {
    intentId: intent.id,
    bookingId: intent.bookingId,
    network,
    payer,
    nonce,
    message,
  };
  const token = await new SignJWT({ challenge })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("vedic-karma")
    .setAudience("wallet-payment-binding")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
  return { message, challengeToken: token };
}
export async function verifyWalletProof(
  intent: Intent,
  token: string,
  signature: string
): Promise<Challenge> {
  if (typeof signature !== "string" || signature.length > 1024)
    throw new Error("Invalid wallet signature");
  const { payload } = await jwtVerify(token, secret(), {
    issuer: "vedic-karma",
    audience: "wallet-payment-binding",
    algorithms: ["HS256"],
  });
  const proof = payload.challenge as Challenge;
  if (
    !proof ||
    proof.intentId !== intent.id ||
    proof.bookingId !== intent.bookingId ||
    Date.now() / 1000 >= intent.deadline
  )
    throw new Error("Wallet proof does not match invoice");
  validateNetworkChoice(intent, proof.network);
  const recovered =
    proof.network === "tron"
      ? Trx.verifyMessageV2(proof.message, signature)
      : verifyMessage(proof.message, signature).toLowerCase();
  if (normalizePayer(proof.network, recovered) !== proof.payer)
    throw new Error("Signature does not belong to the payment wallet");
  return proof;
}
export async function getPaymentBinding(intent: Intent) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return (
    await db
      .select()
      .from(directPaymentBindings)
      .where(
        and(
          eq(directPaymentBindings.bookingId, intent.bookingId),
          eq(directPaymentBindings.intentId, intent.id)
        )
      )
      .limit(1)
  )[0];
}
export async function bindPaymentWallet(
  intent: Intent,
  token: string,
  signature: string
) {
  const proof = await verifyWalletProof(intent, token, signature);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(directPaymentBindings)
    .values({
      bookingId: intent.bookingId,
      intentId: intent.id,
      network: proof.network,
      payer: proof.payer,
      nonceHash: createHash("sha256").update(proof.nonce).digest("hex"),
    })
    .onDuplicateKeyUpdate({ set: { bookingId: intent.bookingId } });
  let binding = await getPaymentBinding(intent);
  if (
    !binding ||
    binding.network !== proof.network ||
    binding.payer !== proof.payer
  )
    throw new Error("Order is already linked to another wallet or network");
  if (!binding.statusToken) {
    const link = await createClientStatusLink({
      bookingId: intent.bookingId,
      expiryHours: 720,
      createdBy: "system:direct-payment",
    });
    await db
      .update(directPaymentBindings)
      .set({ statusToken: link.token })
      .where(
        and(
          eq(directPaymentBindings.bookingId, intent.bookingId),
          isNull(directPaymentBindings.statusToken)
        )
      );
    binding = await getPaymentBinding(intent);
  }
  return binding!;
}
export async function assertPaymentBinding(
  intent: Intent,
  network: CheckoutNetworkId
) {
  if (!intent.bindingRequired) return undefined; // Legacy invoices issued before wallet binding.
  const binding = await getPaymentBinding(intent);
  if (!binding || binding.network !== network)
    throw new Error("Confirm this payment wallet and network first");
  return binding;
}
