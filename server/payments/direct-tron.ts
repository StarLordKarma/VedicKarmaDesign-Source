import { createHash } from "node:crypto";
import { TronWeb } from "tronweb";
import { DEFAULT_TRON_WALLET } from "../../shared/direct-wallet";
import { TRON_PAYMENT } from "../../shared/tron-payment";
import {
  formatTokenUnits,
  type NetworkEstimate,
} from "../../shared/payment-networks";
import type { Intent } from "./direct";

export class TronLatePaymentError extends Error {}
export function tronAddressHex(address: string) {
  if (!TronWeb.isAddress(address) || !address.startsWith("T"))
    throw new Error("Invalid TRON address");
  return TronWeb.address.toHex(address).toLowerCase();
}
export async function tronApi(
  path: string,
  body: Record<string, unknown> = {}
): Promise<any> {
  const base = process.env.DIRECT_TRON_API_URL;
  if (!base?.startsWith("https://")) throw new Error("TRON is not configured");
  const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.TRONGRID_API_KEY
        ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
        : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("TRON service unavailable");
  const result = await response.json();
  if (result.Error || result.error) throw new Error("TRON request failed");
  return result;
}
export async function assertTronMainnet() {
  const block = await tronApi("wallet/getblockbynum", { num: 0 });
  if (`0x${block.blockID?.slice(-8)}` !== TRON_PAYMENT.chainId)
    throw new Error("TRON node is not on Mainnet");
}
export async function prepareTronIntent() {
  if (!process.env.DIRECT_TRON_API_URL) return undefined;
  const recipient =
    process.env.DIRECT_TRON_WALLET_ADDRESS || DEFAULT_TRON_WALLET;
  tronAddressHex(recipient);
  await assertTronMainnet();
  const block = await tronApi("wallet/getnowblock");
  const startBlock = block.block_header?.raw_data?.number;
  if (!Number.isSafeInteger(startBlock)) throw new Error("Invalid TRON block");
  return { recipient, startBlock };
}
export function tronTransferData(intent: Intent) {
  if (!intent.tron) throw new Error("TRON was not offered for this invoice");
  return `a9059cbb${tronAddressHex(intent.tron.recipient).slice(2).padStart(64, "0")}${BigInt(intent.units).toString(16).padStart(64, "0")}${intent.id}`;
}
export async function verifyTronTransfer(
  intent: Intent,
  hash: string,
  expectedPayer?: string
) {
  if (!intent.tron || !/^[a-f0-9]{64}$/i.test(hash))
    throw new Error("Invalid TRON payment");
  await assertTronMainnet();
  const [tx, info] = await Promise.all([
    tronApi("walletsolidity/gettransactionbyid", { value: hash }),
    tronApi("walletsolidity/gettransactioninfobyid", { value: hash }),
  ]);
  if (!tx.txID || !info.id) return false;
  if (
    tx.txID.toLowerCase() !== hash.toLowerCase() ||
    info.id.toLowerCase() !== hash.toLowerCase() ||
    !tx.raw_data_hex ||
    createHash("sha256")
      .update(Buffer.from(tx.raw_data_hex, "hex"))
      .digest("hex") !== hash.toLowerCase()
  )
    throw new Error("Invalid TRON transaction identity");
  if (tx.raw_data?.contract?.length !== 1)
    throw new Error("Unsupported TRON transaction");
  const contract = tx.raw_data.contract[0],
    value = contract.parameter?.value;
  if (
    contract.type !== "TriggerSmartContract" ||
    value?.contract_address?.toLowerCase() !==
      tronAddressHex(TRON_PAYMENT.token) ||
    value?.data?.toLowerCase() !== tronTransferData(intent) ||
    (value.call_value ?? 0) !== 0 ||
    (value.call_token_value ?? 0) !== 0
  )
    throw new Error("TRON transaction does not match this order");
  if (
    tx.ret?.[0]?.contractRet !== "SUCCESS" ||
    info.receipt?.result !== "SUCCESS"
  )
    throw new Error("TRON transaction failed");
  if (
    !Number.isSafeInteger(info.blockNumber) ||
    info.blockNumber < intent.tron.startBlock
  )
    throw new Error("TRON transfer predates the order");
  const block = await tronApi("walletsolidity/getblockbynum", {
    num: info.blockNumber,
  });
  if (
    !block.transactions?.some(
      (t: any) => t.txID?.toLowerCase() === hash.toLowerCase()
    ) ||
    block.block_header?.raw_data?.number !== info.blockNumber
  )
    throw new Error("TRON transfer is not in the confirmed block");
  const owner = value.owner_address?.toLowerCase();
  if (expectedPayer && owner !== tronAddressHex(expectedPayer))
    throw new Error("TRON payer does not match the confirmed wallet");
  if (!/^41[0-9a-f]{40}$/.test(owner)) throw new Error("Invalid TRON sender");
  const paid = info.log?.some(
    (log: any) =>
      log.address?.toLowerCase() ===
        tronAddressHex(TRON_PAYMENT.token).slice(2) &&
      log.topics?.[0] ===
        "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
      log.topics?.[1]?.toLowerCase() === owner.slice(2).padStart(64, "0") &&
      log.topics?.[2]?.toLowerCase() ===
        tronAddressHex(intent.tron!.recipient).slice(2).padStart(64, "0") &&
      BigInt(`0x${log.data}`) === BigInt(intent.units)
  );
  if (!paid) throw new Error("USDT TRC-20 transfer not received");
  const timestamp = block.block_header?.raw_data?.timestamp;
  if (!Number.isSafeInteger(timestamp))
    throw new Error("Missing TRON block timestamp");
  if (timestamp / 1000 > intent.deadline)
    throw new TronLatePaymentError("Late TRON payment needs review");
  return true;
}
export async function estimateTronPayment(
  intent: Intent,
  address: string,
  prices: Record<string, number>
): Promise<NetworkEstimate> {
  const quotedAt = Date.now();
  try {
    tronAddressHex(address);
    if (!intent.tron) throw new Error("TRON not offered");
    await assertTronMainnet();
    const [account, resources, params, balance] = await Promise.all([
      tronApi("wallet/getaccount", { address, visible: true }),
      tronApi("wallet/getaccountresource", { address, visible: true }),
      tronApi("wallet/getchainparameters"),
      tronApi("wallet/triggerconstantcontract", {
        owner_address: address,
        contract_address: TRON_PAYMENT.token,
        function_selector: "balanceOf(address)",
        parameter: tronAddressHex(address).slice(2).padStart(64, "0"),
        visible: true,
      }),
    ]);
    if (
      !account.address ||
      balance.result?.result !== true ||
      !balance.constant_result?.[0]
    )
      throw new Error("TRON account unavailable");
    const tokenUnits = BigInt(`0x${balance.constant_result[0]}`);
    const base = {
      network: "tron" as const,
      quotedAt,
      nativeBalance: formatTokenUnits(String(account.balance || 0), 6),
      tokenBalance: formatTokenUnits(tokenUnits.toString(), 6),
    };
    if (tokenUnits < BigInt(intent.units))
      return { ...base, status: "insufficient_usdt" };
    const simulation = await tronApi("wallet/triggerconstantcontract", {
      owner_address: address,
      contract_address: TRON_PAYMENT.token,
      data: tronTransferData(intent),
      visible: true,
    });
    const energy = simulation.energy_used;
    if (
      simulation.result?.result !== true ||
      simulation.result?.message ||
      !Number.isSafeInteger(energy) ||
      energy <= 0
    )
      throw new Error("TRON simulation failed");
    const chain = Object.fromEntries(
      (params.chainParameter || []).map((p: any) => [p.key, p.value])
    );
    const price = Number(chain.getEnergyFee),
      bytePrice = Number(chain.getTransactionFee);
    if (!(price > 0 && bytePrice > 0))
      throw new Error("Missing TRON resource prices");
    const available = Math.max(
      0,
      (resources.EnergyLimit || 0) - (resources.EnergyUsed || 0)
    );
    const feeLimit = Math.ceil(energy * 1.5 * price);
    if (feeLimit > 200000000)
      throw new Error("TRON fee estimate exceeds the checkout cap");
    // Conservative byte budget includes the signature and node result allowance.
    // Full Bandwidth burn is budgeted, so free/staked Bandwidth can only reduce the actual charge.
    const bytes =
      Math.ceil((simulation.transaction?.raw_data_hex?.length || 1000) / 2) +
      200;
    const expectedSun = Math.ceil(
      Math.max(0, energy - available) * price + bytes * bytePrice
    );
    const budgetSun = Math.ceil(
      Math.max(0, energy * 1.5 - available) * price + bytes * bytePrice * 1.2
    );
    return {
      ...base,
      status:
        Number(account.balance || 0) >= budgetSun
          ? "ready"
          : "insufficient_gas",
      estimatedNative: formatTokenUnits(String(expectedSun), 6),
      budgetNative: formatTokenUnits(String(budgetSun), 6),
      estimatedUsd: prices.TRX ? (expectedSun / 1e6) * prices.TRX : undefined,
      feeLimit,
    };
  } catch {
    return { network: "tron", status: "unavailable", quotedAt };
  }
}
export async function buildTronPayment(
  intent: Intent,
  address: string,
  feeLimit: number
) {
  tronAddressHex(address);
  await assertTronMainnet();
  const built = await tronApi("wallet/triggersmartcontract", {
    owner_address: address,
    contract_address: TRON_PAYMENT.token,
    data: tronTransferData(intent),
    call_value: 0,
    fee_limit: feeLimit,
    visible: true,
  });
  if (
    built.result?.result !== true ||
    built.transaction?.raw_data?.contract?.[0]?.parameter?.value?.data?.toLowerCase() !==
      tronTransferData(intent)
  )
    throw new Error("Could not prepare exact TRON transfer");
  return built.transaction;
}

export async function tronPaymentCandidates(
  intent: Intent
): Promise<{ hashes: string[]; complete: boolean; expired: boolean }> {
  if (!intent.tron) return { hashes: [], complete: true, expired: true };
  await assertTronMainnet();
  const head = await tronApi("walletsolidity/getnowblock");
  const hashes: string[] = [];
  let fingerprint: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(
      `/v1/accounts/${intent.tron.recipient}/transactions/trc20`,
      process.env.DIRECT_TRON_API_URL
    );
    url.search = new URLSearchParams({
      only_confirmed: "true",
      only_to: "true",
      contract_address: TRON_PAYMENT.token,
      min_timestamp: String((intent.deadline - 1800) * 1000),
      max_timestamp: String((intent.deadline + 600) * 1000),
      limit: "200",
      ...(fingerprint ? { fingerprint } : {}),
    }).toString();
    const response = await fetch(url, {
      headers: process.env.TRONGRID_API_KEY
        ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }
        : {},
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("TRON indexing service unavailable");
    const data = await response.json();
    if (data.success !== true || !Array.isArray(data.data))
      throw new Error("Invalid TRON index response");
    for (const event of data.data)
      if (
        event.to === intent.tron.recipient &&
        event.token_info?.address === TRON_PAYMENT.token &&
        /^\d+$/.test(event.value) &&
        BigInt(event.value) === BigInt(intent.units) &&
        /^[a-f0-9]{64}$/i.test(event.transaction_id)
      )
        hashes.push(event.transaction_id);
    fingerprint = data.meta?.fingerprint;
    if (!data.meta?.links?.next)
      return {
        hashes: Array.from(new Set(hashes)),
        complete: true,
        expired:
          (head.block_header?.raw_data?.timestamp || 0) / 1000 >
          intent.deadline + 600,
      };
    if (!fingerprint) throw new Error("TRON pagination is incomplete");
  }
  return {
    hashes: Array.from(new Set(hashes)),
    complete: false,
    expired: false,
  };
}

export async function broadcastTronPayment(
  intent: Intent,
  tx: any,
  expectedPayer?: string
) {
  const raw = tx?.raw_data;
  const contract = raw?.contract?.[0];
  const value = contract?.parameter?.value;
  const addressHex = (address: string) =>
    address?.startsWith("T") ? tronAddressHex(address) : address?.toLowerCase();
  if (
    expectedPayer &&
    addressHex(value?.owner_address) !== tronAddressHex(expectedPayer)
  )
    throw new Error("Wrong TRON payer");
  if (
    !raw ||
    raw.contract?.length !== 1 ||
    contract.type !== "TriggerSmartContract" ||
    addressHex(value?.contract_address) !==
      tronAddressHex(TRON_PAYMENT.token) ||
    value?.data?.toLowerCase() !== tronTransferData(intent) ||
    (value.call_value || 0) !== 0 ||
    (value.call_token_value || 0) !== 0 ||
    !Number.isSafeInteger(raw.fee_limit) ||
    raw.fee_limit <= 0 ||
    raw.fee_limit > 200000000 ||
    !Array.isArray(tx.signature) ||
    tx.signature.length !== 1 ||
    !/^[a-f0-9]{130}$/i.test(tx.signature[0]) ||
    !/^[a-f0-9]+$/i.test(tx.raw_data_hex) ||
    createHash("sha256")
      .update(Buffer.from(tx.raw_data_hex, "hex"))
      .digest("hex") !== tx.txID?.toLowerCase()
  )
    throw new Error("Unexpected signed TRON transaction");
  await assertTronMainnet();
  const result = await tronApi("wallet/broadcasttransaction", tx);
  if (result.result !== true && result.code !== "DUP_TRANSACTION_ERROR")
    throw new Error(
      "TRON broadcast was not confirmed; check the transaction before retrying"
    );
  return tx.txID;
}
