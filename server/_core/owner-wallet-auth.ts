import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { verifyMessage } from "ethers";
import { parse } from "cookie";
import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { upsertUser } from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { createRateLimit } from "../observability";

const STATE_COOKIE = "__Host-vedic-owner-wallet";
const options = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
function configuration() {
  const address = process.env.DIRECT_WALLET_ADDRESS;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address) || !ENV.ownerOpenId || ENV.cookieSecret.length < 32 || !ENV.publicBaseUrl.startsWith("https://")) throw new Error("Owner wallet sign-in is not configured");
  return { address: address.toLowerCase(), origin: new URL(ENV.publicBaseUrl).origin, key: new TextEncoder().encode(ENV.cookieSecret) };
}
export async function createOwnerWalletChallenge() {
  const cfg = configuration(), nonce = randomBytes(32).toString("hex");
  const message = ["Vedic Karma Design - OWNER ADMIN SIGN-IN", `Site: ${cfg.origin}`, `Owner wallet: ${cfg.address}`, `Nonce: ${nonce}`, `Issued at: ${new Date().toISOString()}`, "Expires in 5 minutes.", "This signature grants an 8-hour owner dashboard session. It does not authorize a payment or token spending."].join("\n");
  const state = await new SignJWT({ message, address: cfg.address, nonce }).setProtectedHeader({ alg: "HS256" }).setIssuer(cfg.origin).setAudience("owner-wallet-sign-in").setIssuedAt().setExpirationTime("5m").sign(cfg.key);
  return { state, message, address: cfg.address };
}
export async function verifyOwnerWalletChallenge(state: string, signature: string) {
  const cfg = configuration();
  if (typeof signature !== "string" || !/^0x[a-f0-9]{130}$/i.test(signature)) throw new Error("Invalid wallet signature");
  const { payload } = await jwtVerify(state, cfg.key, { algorithms: ["HS256"], issuer: cfg.origin, audience: "owner-wallet-sign-in", maxTokenAge: "5m" });
  if (payload.address !== cfg.address || typeof payload.message !== "string" || verifyMessage(payload.message, signature).toLowerCase() !== cfg.address) throw new Error("Only the configured owner wallet may sign in");
  return cfg.address;
}
export function registerOwnerWalletAuth(app: Express) {
  if (process.env.AUTH_PROVIDER !== "wallet") return;
  app.get("/api/auth/login", (_req, res) => res.redirect(302, "/owner-login"));
  app.use("/api/auth/wallet", createRateLimit({ name: "owner-wallet-auth", windowMs: 300000, max: 10 }));
  app.post("/api/auth/wallet/challenge", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try { const challenge = await createOwnerWalletChallenge(); res.cookie(STATE_COOKIE, challenge.state, { ...options, maxAge: 300000 }); res.json({ message: challenge.message, address: challenge.address }); }
    catch { res.status(503).json({ error: "Owner wallet sign-in is not configured" }); }
  });
  app.post("/api/auth/wallet/verify", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const state = parse(req.headers.cookie || "")[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, options);
    try {
      if (!state) throw new Error("Start a new sign-in challenge");
      await verifyOwnerWalletChallenge(state, req.body?.signature);
      await upsertUser({ openId: ENV.ownerOpenId, name: ENV.ownerName || "Owner", role: "admin", loginMethod: "owner-wallet", ...(process.env.OWNER_ALERT_EMAIL ? { email: process.env.OWNER_ALERT_EMAIL } : {}), lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(ENV.ownerOpenId, { name: ENV.ownerName || "Owner", expiresInMs: 8 * 60 * 60 * 1000 });
      res.cookie(COOKIE_NAME, session, { ...options, maxAge: 8 * 60 * 60 * 1000 });
      res.json({ ok: true });
    } catch { res.status(403).json({ error: "Owner signature could not be verified. Start again with the configured wallet." }); }
  });
}
