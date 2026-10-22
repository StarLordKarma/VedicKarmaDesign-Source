import { tronAddressHex } from "../payments/direct-tron";
import { DEFAULT_TRON_WALLET } from "../../shared/direct-wallet";
import { DEFAULT_DIRECT_WALLET } from "../../shared/direct-wallet";
import { hasDatabaseConfiguration } from "./database-url";

export function independentConfigurationErrors(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.DEPLOYMENT_MODE !== "independent") return [];
  const errors: string[] = [];
  for (const key of [
    "PUBLIC_BASE_URL",
    "JWT_SECRET",
    "SCHEDULED_TASK_SECRET",
    "OWNER_OPEN_ID",
    "S3_BUCKET",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "OWNER_ALERT_EMAIL",
    "VITE_SOURCE_CODE_URL",
  ]) {
    if (!env[key]?.trim() || /replace-with|example\.com/.test(env[key]!))
      errors.push(`${key} is missing or still a placeholder`);
  }
  if (env.AUTH_PROVIDER === "oidc") for (const key of ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_OWNER_SUBJECT"]) if (!env[key]?.trim() || /replace-with|example\.com/.test(env[key]!)) errors.push(`${key} is missing or still a placeholder`);
  if (env.GEOCODING_PROVIDER !== "geonames" && !env.GOOGLE_MAPS_API_KEY?.trim()) errors.push("GOOGLE_MAPS_API_KEY is missing or still a placeholder");
  const paymentProvider = env.PAYMENT_PROVIDER || "nowpayments";
  const paymentRequirements: Record<string, string[]> = {
    direct: [],
    nowpayments: ["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET"],
    heleket: ["HELEKET_MERCHANT_ID", "HELEKET_PAYMENT_API_KEY"],
    paycrypto: ["PAYCRYPTO_API_KEY", "PAYCRYPTO_WEBHOOK_TOKEN", "PAYCRYPTO_COINS_JSON"],
  };
  if (!paymentRequirements[paymentProvider])
    errors.push("PAYMENT_PROVIDER must be nowpayments, heleket, paycrypto, or direct");
  for (const key of paymentRequirements[paymentProvider] || []) {
    if (!env[key]?.trim() || /replace-with|example\.com/.test(env[key]!))
      errors.push(`${key} is missing or still a placeholder`);
  }
  if (paymentProvider === "direct") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(env.DIRECT_WALLET_ADDRESS || DEFAULT_DIRECT_WALLET) || /^0x0{40}$/i.test(env.DIRECT_WALLET_ADDRESS || DEFAULT_DIRECT_WALLET)) errors.push("DIRECT_WALLET_ADDRESS must be a nonzero EVM address");
    if (env.DIRECT_TRON_API_URL) {
      try { tronAddressHex(env.DIRECT_TRON_WALLET_ADDRESS || DEFAULT_TRON_WALLET); } catch { errors.push("DIRECT_TRON_WALLET_ADDRESS must be a valid TRON Mainnet address"); }
    }
    const rpcKeys = ["DIRECT_RPC_URL", "DIRECT_ETHEREUM_RPC_URL", "DIRECT_POLYGON_RPC_URL", "DIRECT_BNB_RPC_URL", "DIRECT_TRON_API_URL"];
    if (!rpcKeys.some(key => env[key])) errors.push("At least one direct payment network RPC is required");
    for (const key of rpcKeys) {
      if (!env[key]) continue;
      try { if (new URL(env[key]!).protocol !== "https:") errors.push(`${key} requires HTTPS`); } catch { errors.push(`${key} is not a URL`); }
    }
  }
  if (paymentProvider === "paycrypto" && (env.PAYCRYPTO_WEBHOOK_TOKEN?.length ?? 0) < 32)
    errors.push("PAYCRYPTO_WEBHOOK_TOKEN must contain at least 32 characters");
  if (!hasDatabaseConfiguration(env))
    errors.push("DATABASE_URL or Northflank MySQL add-on fields are missing");
  for (const key of ["JWT_SECRET", "SCHEDULED_TASK_SECRET"])
    if ((env[key]?.length ?? 0) < 32)
      errors.push(`${key} must contain at least 32 characters`);
  for (const key of [
    "PUBLIC_BASE_URL",
    "OIDC_ISSUER",
    "LLM_BASE_URL",
    "S3_ENDPOINT",
  ]) {
    if (env[key]) {
      try {
        if (new URL(env[key]!).protocol !== "https:")
          errors.push(`${key} requires HTTPS`);
      } catch {
        errors.push(`${key} is not a URL`);
      }
    }
  }
  if (!["oidc", "wallet"].includes(env.AUTH_PROVIDER || "")) errors.push("AUTH_PROVIDER must be oidc or wallet");
  if (env.AUTH_PROVIDER === "wallet" && (!/^0x[0-9a-fA-F]{40}$/.test(env.DIRECT_WALLET_ADDRESS || "") || /^0x0{40}$/i.test(env.DIRECT_WALLET_ADDRESS || ""))) errors.push("Wallet owner authentication requires nonzero DIRECT_WALLET_ADDRESS");
  if (env.STORAGE_PROVIDER !== "s3") errors.push("STORAGE_PROVIDER must be s3");
  if (env.NOTIFICATION_PROVIDER !== "resend")
    errors.push("NOTIFICATION_PROVIDER must be resend");
  if (env.CALCULATION_ENGINE_LICENSE !== "AGPL-3.0-or-later")
    errors.push(
      "CALCULATION_ENGINE_LICENSE must acknowledge AGPL-3.0-or-later"
    );
  if (!/^\d+$/.test(env.TRUST_PROXY_HOPS || "0"))
    errors.push("TRUST_PROXY_HOPS must be a nonnegative integer");
  for (const key of [
    "NOWPAYMENTS_BASE_URL",
    "HELEKET_BASE_URL",
    "PAYCRYPTO_BASE_URL",
    "RESEND_BASE_URL",
    "MAPS_BASE_URL",
  ]) {
    if (env[key] && !env[key]!.startsWith("https://"))
      errors.push(`${key} requires HTTPS in independent production`);
  }
  if (env.NOWPAYMENTS_BASE_URL) {
    try {
      if (new URL(env.NOWPAYMENTS_BASE_URL).hostname !== "api.nowpayments.io")
        errors.push("NOWPAYMENTS_BASE_URL must use the official production host");
    } catch {
      // The generic URL validation above already reports this case.
    }
  }
  for (const [key, hostname] of [
    ["HELEKET_BASE_URL", "api.heleket.com"],
    ["PAYCRYPTO_BASE_URL", "paycrypto.global"],
  ] as const) {
    if (!env[key]) continue;
    try {
      if (new URL(env[key]!).hostname !== hostname)
        errors.push(`${key} must use the official production host`);
    } catch {
      // The generic URL validation above already reports this case.
    }
  }
  return errors;
}

export function sandboxConfigurationErrors(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.DEPLOYMENT_MODE !== "sandbox") return [];
  const errors: string[] = [];
  if (env.AUTH_PROVIDER !== "sandbox")
    errors.push("AUTH_PROVIDER must be sandbox");
  if ((env.SANDBOX_AUTH_TOKEN?.length ?? 0) < 32)
    errors.push("SANDBOX_AUTH_TOKEN must contain at least 32 characters");
  try {
    const url = new URL(env.PUBLIC_BASE_URL || "");
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      errors.push("Sandbox PUBLIC_BASE_URL must be local HTTP");
  } catch {
    errors.push("Sandbox PUBLIC_BASE_URL is not a URL");
  }
  return errors;
}
