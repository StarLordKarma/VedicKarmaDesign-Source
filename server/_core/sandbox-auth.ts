import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { upsertUser } from "../db";

function matches(expected: string, received: unknown) {
  if (!expected || typeof received !== "string") return false;
  const left = Buffer.from(expected),
    right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function registerSandboxAuthRoutes(app: Express) {
  if (
    process.env.DEPLOYMENT_MODE !== "sandbox" ||
    process.env.AUTH_PROVIDER !== "sandbox"
  )
    return;
  app.get("/api/auth/login", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const base = new URL(ENV.publicBaseUrl);
    if (
      !["localhost", "127.0.0.1"].includes(base.hostname) ||
      !matches(process.env.SANDBOX_AUTH_TOKEN || "", req.query.token)
    ) {
      res.status(403).send("Sandbox login denied.");
      return;
    }
    await upsertUser({
      openId: ENV.ownerOpenId,
      name: ENV.ownerName,
      email: "owner@sandbox.invalid",
      loginMethod: "sandbox",
      role: "admin",
      lastSignedIn: new Date(),
    });
    const session = await sdk.createSessionToken(ENV.ownerOpenId, {
      name: ENV.ownerName,
      expiresInMs: 8 * 60 * 60 * 1000,
    });
    res.cookie(COOKIE_NAME, session, {
      ...getSessionCookieOptions(req),
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.redirect(302, "/admin");
  });
}
