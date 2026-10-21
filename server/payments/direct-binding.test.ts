import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Wallet } from "ethers";
import { Trx, TronWeb } from "tronweb";
import { createWalletChallenge, verifyWalletProof } from "./direct-binding";
import type { Intent } from "./direct";
const wallet = Wallet.createRandom();
let intent: Intent;
beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "test-secret-".repeat(5));
  intent = {
    bookingId: 12,
    id: "ab".repeat(32),
    recipient: `0x${"12".repeat(20)}`,
    units: "25000000",
    amount: "25.00",
    startBlock: "0x10",
    deadline: Math.floor(Date.now() / 1000) + 1800,
    options: [{ network: "polygon", startBlock: "0x10" }],
    tron: { recipient: "TLjWhpJwVAmYYv55CVYDVppenstMXvX3si", startBlock: 1 },
    bindingRequired: true,
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("one-time wallet proof", () => {
  it("binds an EVM signature to the exact order, token, network and recipient", async () => {
    const challenge = await createWalletChallenge(
      intent,
      "polygon",
      wallet.address,
      "https://site.test"
    );
    const proof = await verifyWalletProof(
      intent,
      challenge.challengeToken,
      await wallet.signMessage(challenge.message)
    );
    expect(proof.network).toBe("polygon");
    expect(proof.payer).toBe(wallet.address.toLowerCase());
    expect(challenge.message).toContain("USDT0");
    expect(challenge.message).toContain(intent.recipient);
  });
  it("rejects signatures from another wallet", async () => {
    const challenge = await createWalletChallenge(
      intent,
      "polygon",
      wallet.address,
      "https://site.test"
    );
    await expect(
      verifyWalletProof(
        intent,
        challenge.challengeToken,
        await Wallet.createRandom().signMessage(challenge.message)
      )
    ).rejects.toThrow("does not belong");
  });
  it("rejects replay against another order", async () => {
    const challenge = await createWalletChallenge(
      intent,
      "polygon",
      wallet.address,
      "https://site.test"
    );
    await expect(
      verifyWalletProof(
        { ...intent, bookingId: 99 },
        challenge.challengeToken,
        await wallet.signMessage(challenge.message)
      )
    ).rejects.toThrow("does not match");
  });
  it("rejects an unoffered network", async () => {
    await expect(
      createWalletChallenge(intent, "bnb", wallet.address, "https://site.test")
    ).rejects.toThrow("not offered");
  });
  it("expires a challenge after five minutes", async () => {
    vi.useFakeTimers();
    const challenge = await createWalletChallenge(
      intent,
      "polygon",
      wallet.address,
      "https://site.test"
    );
    const sig = await wallet.signMessage(challenge.message);
    vi.setSystemTime(Date.now() + 360000);
    await expect(
      verifyWalletProof(intent, challenge.challengeToken, sig)
    ).rejects.toThrow();
  });
  it("verifies the distinct TRON signed-message format", async () => {
    const tronAddress = TronWeb.address.fromPrivateKey(
      wallet.privateKey.slice(2)
    ) as string;
    const challenge = await createWalletChallenge(
      intent,
      "tron",
      tronAddress,
      "https://site.test"
    );
    const signature = Trx.signMessageV2(
      challenge.message,
      wallet.privateKey.slice(2)
    );
    const proof = await verifyWalletProof(
      intent,
      challenge.challengeToken,
      signature
    );
    expect(proof.network).toBe("tron");
    expect(proof.payer).toBe(tronAddress);
  });
});
