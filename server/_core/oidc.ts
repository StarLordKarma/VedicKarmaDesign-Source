import { createHash, randomBytes } from "node:crypto";
import { parse } from "cookie";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { Express } from "express";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { upsertUser } from "../db";

const STATE_COOKIE = "__Host-vedic-oidc";
const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
const secret = () => new TextEncoder().encode(ENV.cookieSecret);
const random = () => randomBytes(32).toString("base64url");

function config() {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret || !process.env.OIDC_OWNER_SUBJECT || !ENV.ownerOpenId || ENV.cookieSecret.length < 32) throw new Error("OIDC owner configuration is incomplete");
  if (!issuer.startsWith("https://") || !ENV.publicBaseUrl.startsWith("https://")) throw new Error("OIDC requires HTTPS");
  return { issuer, clientId, clientSecret, redirectUri: `${ENV.publicBaseUrl.replace(/\/+$/, "")}/api/auth/callback` };
}

async function discovery() {
  const cfg = config();
  const response = await fetch(`${cfg.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!response.ok) throw new Error("OIDC discovery unavailable");
  const metadata = await response.json() as { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
  if (metadata.issuer !== cfg.issuer) throw new Error("OIDC issuer mismatch");
  for (const endpoint of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]) {
    if (new URL(endpoint).protocol !== "https:") throw new Error("OIDC endpoints require HTTPS");
  }
  return { cfg, metadata };
}

export function assertOwnerClaims(payload: JWTPayload, clientId: string, nonce: string, ownerSubject: string) {
  if (!payload.sub || payload.sub !== ownerSubject || payload.nonce !== nonce) throw new Error("Owner identity or nonce mismatch");
  if ((Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId) || (payload.azp !== undefined && payload.azp !== clientId)) throw new Error("Invalid authorized party");
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") throw new Error("Missing token lifetime");
}

export function registerOidcRoutes(app: Express) {
  if (process.env.AUTH_PROVIDER !== "oidc") return;
  app.get("/api/auth/login", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const { cfg, metadata } = await discovery();
      const state = random(), nonce = random(), verifier = random();
      const transaction = await new SignJWT({ state, nonce, verifier }).setProtectedHeader({ alg: "HS256" }).setAudience("oidc-transaction").setIssuedAt().setExpirationTime("10m").sign(secret());
      res.cookie(STATE_COOKIE, transaction, { ...cookieOptions, maxAge: 600_000 });
      const url = new URL(metadata.authorization_endpoint);
      for (const [key, value] of Object.entries({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", scope: "openid profile", state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })) url.searchParams.set(key, value);
      res.redirect(302, url.toString());
    } catch { res.status(503).send("Owner sign-in is not configured or temporarily unavailable."); }
  });
  app.get("/api/auth/callback", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const transaction = parse(req.headers.cookie ?? "")[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, cookieOptions);
    try {
      if (!transaction || typeof req.query.code !== "string" || typeof req.query.state !== "string") throw new Error("Missing authorization response");
      const { payload: saved } = await jwtVerify(transaction, secret(), { algorithms: ["HS256"], audience: "oidc-transaction" });
      if (saved.state !== req.query.state || typeof saved.verifier !== "string" || typeof saved.nonce !== "string") throw new Error("Invalid authorization state");
      const { cfg, metadata } = await discovery();
      const response = await fetch(metadata.token_endpoint, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64")}` },
        body: new URLSearchParams({ grant_type: "authorization_code", code: req.query.code, redirect_uri: cfg.redirectUri, code_verifier: saved.verifier }), signal: AbortSignal.timeout(15_000), redirect: "error",
      });
      if (!response.ok) throw new Error("Token exchange failed");
      const tokens = await response.json() as { id_token?: string };
      if (!tokens.id_token) throw new Error("Missing ID token");
      const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(metadata.jwks_uri)), { algorithms: ["RS256", "ES256"], issuer: cfg.issuer, audience: cfg.clientId, maxTokenAge: "10m" });
      assertOwnerClaims(payload, cfg.clientId, saved.nonce, process.env.OIDC_OWNER_SUBJECT!);
      await upsertUser({ openId: ENV.ownerOpenId, name: ENV.ownerName, loginMethod: "oidc", lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(ENV.ownerOpenId, { name: ENV.ownerName, expiresInMs: 8 * 60 * 60 * 1000 });
      res.cookie(COOKIE_NAME, session, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
      res.redirect(302, "/admin");
    } catch { res.status(403).send("Sign-in could not be verified. Please start again from the admin page."); }
  });
}
