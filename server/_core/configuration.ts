export function independentConfigurationErrors(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.DEPLOYMENT_MODE !== "independent") return [];
  const errors: string[] = [];
  for (const key of [
    "PUBLIC_BASE_URL",
    "DATABASE_URL",
    "JWT_SECRET",
    "SCHEDULED_TASK_SECRET",
    "OWNER_OPEN_ID",
    "OIDC_ISSUER",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_OWNER_SUBJECT",
    "S3_BUCKET",
    "GOOGLE_MAPS_API_KEY",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "NOWPAYMENTS_API_KEY",
    "NOWPAYMENTS_IPN_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "OWNER_ALERT_EMAIL",
    "VITE_SOURCE_CODE_URL",
  ]) {
    if (!env[key]?.trim() || /replace-with|example\.com/.test(env[key]!))
      errors.push(`${key} is missing or still a placeholder`);
  }
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
  if (env.AUTH_PROVIDER !== "oidc") errors.push("AUTH_PROVIDER must be oidc");
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
    "RESEND_BASE_URL",
    "MAPS_BASE_URL",
  ]) {
    if (env[key] && !env[key]!.startsWith("https://"))
      errors.push(`${key} requires HTTPS in independent production`);
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
