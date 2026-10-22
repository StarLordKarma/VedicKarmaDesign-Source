import { describe, expect, it } from "vitest";
import {
  independentConfigurationErrors,
  sandboxConfigurationErrors,
} from "./_core/configuration";
describe("independent launch safety", () => {
  it("fails closed with actionable names but never echoes secret values", () => {
    const errors = independentConfigurationErrors({
      DEPLOYMENT_MODE: "independent",
      JWT_SECRET: "sensitive",
      PUBLIC_BASE_URL: "http://localhost",
      AUTH_PROVIDER: "manus",
    });
    expect(errors.join(" ")).toContain("OWNER_OPEN_ID");
    expect(errors.join(" ")).toContain("requires HTTPS");
    expect(errors.join(" ")).not.toContain("sensitive");
    expect(errors.join(" ")).toContain("AUTH_PROVIDER must be oidc");
    expect(errors.join(" ")).toContain("CALCULATION_ENGINE_LICENSE");
  });
  it("preserves the existing managed deployment configuration", () => {
    expect(independentConfigurationErrors({})).toEqual([]);
  });
  it("requires OIDC credentials only for OIDC and explicit owner identity for wallet login", () => {
    const oidc = independentConfigurationErrors({ DEPLOYMENT_MODE: "independent", AUTH_PROVIDER: "oidc" }).join(" ");
    expect(oidc).toContain("OIDC_CLIENT_ID");
    const wallet = independentConfigurationErrors({ DEPLOYMENT_MODE: "independent", AUTH_PROVIDER: "wallet" }).join(" ");
    expect(wallet).not.toContain("OIDC_CLIENT_ID");
    expect(wallet).toContain("DIRECT_WALLET_ADDRESS");
    expect(wallet).toContain("OWNER_OPEN_ID");
  });
  it("rejects invalid direct wallet settings without requiring a gateway key", () => {
    const errors = independentConfigurationErrors({ DEPLOYMENT_MODE: "independent", PAYMENT_PROVIDER: "direct", DIRECT_WALLET_ADDRESS: "0x" + "0".repeat(40), DIRECT_RPC_URL: "http://localhost" });
    expect(errors.join(" ")).toContain("nonzero EVM address");
    expect(errors.join(" ")).toContain("DIRECT_RPC_URL requires HTTPS");
    expect(errors.join(" ")).not.toContain("NOWPAYMENTS_API_KEY");
  });
  it("requires provider-specific credentials and rejects mock payment hosts", () => {
    const base = {
      DEPLOYMENT_MODE: "independent",
      PAYMENT_PROVIDER: "paycrypto",
      PAYCRYPTO_BASE_URL: "https://mock-payments.example.test/v1",
    };
    const errors = independentConfigurationErrors(base);
    expect(errors.join(" ")).toContain("PAYCRYPTO_API_KEY");
    expect(errors.join(" ")).toContain("PAYCRYPTO_WEBHOOK_TOKEN");
    expect(errors.join(" ")).toContain("official production host");
  });
});

describe("sandbox configuration", () => {
  it("accepts only a local, explicit and strongly-tokened sandbox login", () => {
    expect(
      sandboxConfigurationErrors({
        DEPLOYMENT_MODE: "sandbox",
        AUTH_PROVIDER: "sandbox",
        PUBLIC_BASE_URL: "http://127.0.0.1:3000",
        SANDBOX_AUTH_TOKEN: "x".repeat(32),
      })
    ).toEqual([]);
    expect(
      sandboxConfigurationErrors({
        DEPLOYMENT_MODE: "sandbox",
        AUTH_PROVIDER: "oidc",
        PUBLIC_BASE_URL: "https://public.example",
        SANDBOX_AUTH_TOKEN: "short",
      }).join(" ")
    ).toContain("AUTH_PROVIDER");
    expect(
      sandboxConfigurationErrors({
        DEPLOYMENT_MODE: "sandbox",
        AUTH_PROVIDER: "oidc",
        PUBLIC_BASE_URL: "https://public.example",
        SANDBOX_AUTH_TOKEN: "short",
      }).join(" ")
    ).toContain("must be local");
  });
});
