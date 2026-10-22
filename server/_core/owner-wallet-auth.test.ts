import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Wallet } from "ethers";
import { SignJWT } from "jose";
import { ENV } from "./env";
import { createOwnerWalletChallenge, verifyOwnerWalletChallenge, registerOwnerWalletAuth } from "./owner-wallet-auth";
const owner = Wallet.createRandom(), key = "owner-session-test-".repeat(4);
let previous: any;
beforeEach(() => { previous = { cookieSecret: ENV.cookieSecret, ownerOpenId: ENV.ownerOpenId, publicBaseUrl: ENV.publicBaseUrl }; Object.assign(ENV, { cookieSecret: key, ownerOpenId: "test-owner", publicBaseUrl: "https://site.test" }); vi.stubEnv("DIRECT_WALLET_ADDRESS", owner.address); });
afterEach(() => { Object.assign(ENV, previous); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("explicit owner wallet authentication", () => {
  it("identifies the administrative scope and exact origin, without granting token spending", async () => {
    const challenge = await createOwnerWalletChallenge(); expect(challenge.message).toContain("OWNER ADMIN SIGN-IN"); expect(challenge.message).toContain("https://site.test"); expect(challenge.message).toContain("8-hour owner dashboard session"); expect(challenge.message).toContain("does not authorize a payment");
    await expect(verifyOwnerWalletChallenge(challenge.state, await owner.signMessage(challenge.message))).resolves.toBe(owner.address.toLowerCase());
  });
  it("rejects another wallet, changed receiving identity and tampered state", async () => {
    const challenge = await createOwnerWalletChallenge();
    await expect(verifyOwnerWalletChallenge(challenge.state, await Wallet.createRandom().signMessage(challenge.message))).rejects.toThrow("Only the configured");
    await expect(verifyOwnerWalletChallenge(challenge.state.slice(0, -5) + "xxxxx", await owner.signMessage(challenge.message))).rejects.toThrow();
    vi.stubEnv("DIRECT_WALLET_ADDRESS", Wallet.createRandom().address);
    await expect(verifyOwnerWalletChallenge(challenge.state, await owner.signMessage(challenge.message))).rejects.toThrow("Only the configured");
  });
  it("does not accept a public payment signature in the owner audience", async () => {
    const message = "Public order wallet binding";
    const state = await new SignJWT({ message, address: owner.address.toLowerCase() }).setProtectedHeader({ alg: "HS256" }).setIssuer("https://site.test").setAudience("wallet-payment-binding").setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(key));
    await expect(verifyOwnerWalletChallenge(state, await owner.signMessage(message))).rejects.toThrow();
  });
  it("expires the sign-in challenge after five minutes", async () => {
    vi.useFakeTimers(); const challenge = await createOwnerWalletChallenge(), signature = await owner.signMessage(challenge.message); vi.setSystemTime(Date.now() + 301000); await expect(verifyOwnerWalletChallenge(challenge.state, signature)).rejects.toThrow();
  });
  it("does not expose wallet authentication until the owner explicitly enables its provider", () => {
    vi.stubEnv("AUTH_PROVIDER", "oidc"); const app = { get: vi.fn(), post: vi.fn(), use: vi.fn() }; registerOwnerWalletAuth(app as any); expect(app.post).not.toHaveBeenCalled(); expect(app.get).not.toHaveBeenCalled();
  });
});
