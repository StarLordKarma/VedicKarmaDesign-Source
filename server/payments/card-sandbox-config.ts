export function cardSandboxEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (
    env.DEPLOYMENT_MODE !== "sandbox" ||
    env.CARD_SANDBOX_ONLY !== "true" ||
    env.AUTH_PROVIDER !== "sandbox"
  )
    return false;
  try {
    const url = new URL(env.PUBLIC_BASE_URL || "");
    const db = new URL(env.DATABASE_URL || "");
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["mysql", "localhost", "127.0.0.1"].includes(db.hostname) &&
      /sandbox/.test(db.pathname)
    );
  } catch {
    return false;
  }
}
export function assertCardSandbox() {
  if (!cardSandboxEnabled())
    throw Error("Card checkout is available only in the isolated sandbox");
}

/** Temporary public fixture receivers must never outlive their configured TTL.
 * After expiry new fixture orders use the local callback again. */
export function sandboxCardCallbackBase(
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now()
) {
  if (!cardSandboxEnabled(env))
    throw Error("Callback requires the isolated sandbox");
  const local = new URL(env.PUBLIC_BASE_URL!);
  try {
    const external = new URL(env.RISKPAY_CALLBACK_BASE_URL || "");
    const expiresAt = Date.parse(env.RISKPAY_CALLBACK_EXPIRES_AT || "");
    if (
      external.protocol === "https:" &&
      !external.username &&
      !external.password &&
      !external.port &&
      external.pathname === "/" &&
      !external.search &&
      !external.hash &&
      !["localhost", "127.0.0.1", "[::1]"].includes(external.hostname) &&
      Number.isSafeInteger(expiresAt) &&
      expiresAt > now &&
      expiresAt - now <= 60 * 60 * 1000
    )
      return external.origin;
  } catch {
    /* Missing or invalid external configuration falls back to local. */
  }
  return local.origin;
}
