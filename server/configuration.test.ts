import { describe, expect, it } from "vitest";
import { independentConfigurationErrors } from "./_core/configuration";
describe("independent launch safety", () => {
  it("fails closed with actionable names but never echoes secret values", () => {
    const errors = independentConfigurationErrors({ DEPLOYMENT_MODE: "independent", JWT_SECRET: "sensitive", PUBLIC_BASE_URL: "http://localhost", AUTH_PROVIDER: "manus" });
    expect(errors.join(" ")).toContain("OIDC_CLIENT_ID");
    expect(errors.join(" ")).toContain("requires HTTPS");
    expect(errors.join(" ")).not.toContain("sensitive");
    expect(errors.join(" ")).toContain("AUTH_PROVIDER must be oidc");
  });
  it("preserves the existing managed deployment configuration", () => {
    expect(independentConfigurationErrors({})).toEqual([]);
  });
});
