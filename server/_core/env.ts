export const ENV = {
  appId:
    process.env.VITE_APP_ID ||
    (["oidc", "sandbox"].includes(process.env.AUTH_PROVIDER || "")
      ? "vedic-karma-design"
      : ""),
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerName: process.env.OWNER_NAME ?? "Account owner",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  nowpaymentsApiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
  nowpaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
  productionSmokeSecret: process.env.PRODUCTION_SMOKE_SECRET ?? "",
};
