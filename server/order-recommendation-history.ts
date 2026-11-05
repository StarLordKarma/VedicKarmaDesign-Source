import { createHmac, timingSafeEqual } from "node:crypto";
const products = [
  "tarot",
  "portrait",
  "daily",
  "monthly",
  "vedic_basic",
  "vedic_plus",
  "basic",
  "basic_plus",
];
function key() {
  const k = process.env.ORDER_SIGNING_SECRET;
  if (!k || k.length < 32) return null;
  return k;
}
const mac = (value: string, k: string) =>
  createHmac("sha256", k).update(value).digest("base64url");
export function readRecommendationHistory(
  token: string | undefined,
  email: string,
  now = Date.now()
): string[] {
  const k = key();
  if (!k || !token || token.length > 2048) return [];
  try {
    const [body, signature, ...rest] = token.split(".");
    if (rest.length || !signature) return [];
    const actual = Buffer.from(signature),
      expected = Buffer.from(mac(body, k));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return [];
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      p.v !== 1 ||
      !Number.isSafeInteger(p.exp) ||
      p.exp < now ||
      p.recipient !== mac(email.trim().toLowerCase(), k) ||
      !Array.isArray(p.products) ||
      p.products.length > 8
    )
      return [];
    return Array.from(
      new Set<string>(p.products.filter((v: any) => products.includes(v)))
    );
  } catch {
    return [];
  }
}
export function writeRecommendationHistory(
  email: string,
  paidProducts: string[],
  now = Date.now()
): string | undefined {
  const k = key();
  if (!k) return undefined;
  const body = Buffer.from(
    JSON.stringify({
      v: 1,
      recipient: mac(email.trim().toLowerCase(), k),
      products: Array.from(
        new Set(paidProducts.filter(v => products.includes(v)))
      ),
      exp: now + 365 * 86400000,
    })
  ).toString("base64url");
  return body + "." + mac(body, k);
}
