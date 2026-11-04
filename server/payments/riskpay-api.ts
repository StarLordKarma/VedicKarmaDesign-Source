/** RiskPay's documented protocol. No live request is allowed by default.
 * Source: https://documenter.getpostman.com/view/2104539/2sB2cPkRGz
 */
import { z } from "zod";
export const RISKPAY_API = "https://api.riskpay.biz";
export const RISKPAY_PAY = "https://pay.riskpay.biz";
export const FIAT_PAYMENT_METHODS = [
  "card",
  "apple_pay",
  "google_pay",
] as const;
export type FiatPaymentMethod = (typeof FIAT_PAYMENT_METHODS)[number];
export function isFiatPaymentMethod(
  value: unknown
): value is FiatPaymentMethod {
  return FIAT_PAYMENT_METHODS.includes(value as FiatPaymentMethod);
}
const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .refine(s => !/^0x0{40}$/i.test(s));
const opaque = z
  .string()
  .min(8)
  .max(4096)
  .refine(s => !/[\r\n\x00]/.test(s));
const walletSchema = z.object({
  address_in: opaque,
  polygon_address_in: address,
  callback_url: z.string().url(),
  ipn_token: opaque,
});
const decodeOnce = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw Error("RiskPay returned malformed encoding");
  }
};
export function parseRiskPayWallet(value: unknown, expectedCallback: string) {
  const wallet = walletSchema.parse(value);
  if (wallet.callback_url !== expectedCallback)
    throw Error("RiskPay changed the callback binding");
  return {
    encryptedAddress: decodeOnce(wallet.address_in),
    assignedAddress: wallet.polygon_address_in.toLowerCase(),
    ipnToken: decodeOnce(wallet.ipn_token),
  };
}
export type RiskPayWallet = ReturnType<typeof parseRiskPayWallet>;
export function riskPayHostedUrl(input: {
  wallet: RiskPayWallet;
  email: string;
  grossCents: number;
  currency: string;
  method: FiatPaymentMethod;
}) {
  if (
    !isFiatPaymentMethod(input.method) ||
    !Number.isSafeInteger(input.grossCents) ||
    input.grossCents <= 0 ||
    input.grossCents > 100000000 ||
    !z.email().safeParse(input.email).success ||
    input.currency !== "USD"
  )
    throw Error("Invalid RiskPay checkout input");
  const url = new URL("/payment-creating.php", RISKPAY_PAY);
  url.searchParams.set("address", input.wallet.encryptedAddress);
  url.searchParams.set("email", input.email);
  url.searchParams.set("amount", (input.grossCents / 100).toFixed(2));
  url.searchParams.set("currency", input.currency);
  // The API documents no Apple/Google Pay selector. Preference is retained on
  // our order; the hosted gateway chooses available methods and providers.
  return url.href;
}
export function createRiskPayApi(options: {
  mode: "fixture" | "live";
  fetcher?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}) {
  const env = options.env || process.env;
  const allowed = () => {
    if (options.mode === "fixture") {
      if (!options.fetcher)
        throw Error("RiskPay fixture mode needs an offline transport");
      return;
    }
    if (env.RISKPAY_LIVE_ENABLED !== "true")
      throw Error("RiskPay live API is not enabled; no request was sent");
  };
  async function get(path: string, params: Record<string, string>) {
    allowed();
    const url = new URL(path, RISKPAY_API);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = await (options.fetcher || fetch)(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw Error("RiskPay API request failed");
    const raw = await response.text();
    if (raw.length > 65536) throw Error("RiskPay API response too large");
    return JSON.parse(raw);
  }
  return {
    async createWallet(input: { merchantWallet: string; callbackUrl: string }) {
      address.parse(input.merchantWallet);
      const callback = new URL(input.callbackUrl);
      if (
        !callback.searchParams.get("order") ||
        !/^([a-f0-9]{64})$/.test(callback.searchParams.get("token") || "")
      )
        throw Error(
          "RiskPay callback needs a unique order and private capability"
        );
      if (
        options.mode === "live" &&
        (callback.protocol !== "https:" ||
          ["localhost", "127.0.0.1"].includes(callback.hostname))
      )
        throw Error("Live RiskPay requires a public HTTPS callback");
      const raw = await get("/control/wallet.php", {
        address: input.merchantWallet,
        callback: callback.href,
      });
      const wallet = parseRiskPayWallet(raw, callback.href);
      if (wallet.assignedAddress === input.merchantWallet.toLowerCase())
        throw Error("RiskPay did not allocate a separate order wallet");
      return wallet;
    },
    async status(ipnToken: string) {
      opaque.parse(ipnToken);
      const raw = await get("/control/payment-status.php", {
        ipn_token: ipnToken,
      });
      return z
        .object({
          status: z.enum(["paid", "unpaid"]),
          value_coin: z
            .string()
            .regex(/^\d+(\.\d{1,6})?$/)
            .optional(),
          txid_out: z
            .string()
            .regex(/^0x[0-9a-fA-F]{64}$/)
            .optional(),
          coin: z.string().max(32).optional(),
        })
        .parse(raw);
    },
  };
}
