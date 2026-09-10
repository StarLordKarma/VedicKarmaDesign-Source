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
    expect(errors.join(" ")).toContain("OIDC_CLIENT_ID");
    expect(errors.join(" ")).toContain("requires HTTPS");
    expect(errors.join(" ")).not.toContain("sensitive");
    expect(errors.join(" ")).toContain("AUTH_PROVIDER must be oidc");
    expect(errors.join(" ")).toContain("CALCULATION_ENGINE_LICENSE");
  });
  it("preserves the existing managed deployment configuration", () => {
    expect(independentConfigurationErrors({})).toEqual([]);
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
