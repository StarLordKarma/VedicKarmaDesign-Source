import { riskPayManualEnabled } from './riskpay-manual-policy';
import type { Express, Request } from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { cardSandboxEnabled } from "./card-sandbox-config";
import {
  getSandboxCardCheckout,
  simulateSandboxCard,
  requestSandboxCardRefund,
  quoteSandboxCardRefund,
  acceptSandboxCardRefund,
  confirmSandboxCardRefund,
  startCardSandboxWorker,
  listSandboxCardOrders,
  recordSandboxRiskPayCallback,
  getSandboxCardFunds,
} from "./card-sandbox-checkout";
import { formatMicroUsdc } from "./card-reserve";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { createRateLimit } from "../observability";
import { CARD_COPY } from "../../reading-core/payments/copy.mjs";
async function isOwner(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    return (
      !!user &&
      user.role === "admin" &&
      !!ENV.ownerOpenId &&
      user.openId === ENV.ownerOpenId
    );
  } catch {
    return false;
  }
}
export function registerCardSandboxRoutes(app: Express) {
  app.get("/api/card-options", (_req, res) =>
    res
      .set("Cache-Control", "no-store")
      .json({ sandbox: cardSandboxEnabled(), card: cardSandboxEnabled() || riskPayManualEnabled() })
  );
  app.get("/readings/payments/copy.mjs", (_req, res) =>
    res.type("js").sendFile(resolve("reading-core/payments/copy.mjs"))
  );
  if (!cardSandboxEnabled()) return;
  app.use(
    "/api/riskpay",
    createRateLimit({ name: "riskpay-callback", windowMs: 60000, max: 30 })
  );
  app.get("/api/riskpay/callback", async (req, res) => {
    try {
      const key = z
        .object({
          order: z.string().regex(/^[1-9]\d{0,9}$/),
          token: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .parse(req.query);
      const result = await recordSandboxRiskPayCallback(
        key.order + "." + key.token,
        req.query
      );
      res.set("Cache-Control", "no-store").status(202).json(result);
    } catch {
      res.status(400).json({ error: "unverified_riskpay_callback" });
    }
  });
  startCardSandboxWorker();
  app.get("/sandbox/card-owner", async (req, res) => {
    if (!(await isOwner(req))) {
      res
        .status(403)
        .type("html")
        .send('<a href="/owner-login">Owner sign-in required</a>');
      return;
    }
    try {
      const lang = ["en", "ru", "de", "es"].includes(String(req.query.lang))
          ? (String(req.query.lang) as keyof typeof CARD_COPY)
          : "ru",
        c = CARD_COPY[lang];
      const rows = await listSandboxCardOrders();
      const funds = await getSandboxCardFunds();
      const fundRows = [
        [c.reserveReceived, funds.receivedMicroUsdc],
        [c.reserveRefunded, funds.refundedMicroUsdc],
        [c.reserveCommitted, funds.committedRefundMicroUsdc],
        [c.reserveBalance, funds.unallocatedMicroUsdc],
        [c.reserveHeld, funds.reservedMicroUsdc],
        [c.reserveDistributable, funds.distributableMicroUsdc],
        [c.reserveShortfall, funds.shortfallMicroUsdc],
      ]
        .map(
          ([label, value]) =>
            `<p>${label}: <strong>${formatMicroUsdc(value)}</strong></p>`
        )
        .join("");
      res
        .set({
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex,nofollow",
        })
        .type("html")
        .send(
          `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.owner}</title><link rel="stylesheet" href="/readings/site.css"></head><body data-mode="vedic"><main class="card-checkout wrap"><a href="/admin">← Karma Life Design</a><p class="payment-preview">${c.sandbox}</p><h1>${c.owner}</h1><p>${c.manual}</p><section class="checkout-panel"><h2>${c.reserveTitle}</h2>${fundRows}<p>${c.reservePending}</p></section><div class="checkout-panel">${rows.map(row => `<p><a href="${row.url}">#${row.id} · ${c[row.status] || row.status} · ${row.refund}</a></p>`).join("")}</div></main></body></html>`
        );
    } catch {
      res.status(503).send("Sandbox orders unavailable");
    }
  });
  app.use(
    "/api/card-sandbox",
    createRateLimit({ name: "card-sandbox", windowMs: 60000, max: 90 })
  );
  for (const name of ["copy.mjs", "checkout.mjs"])
    app.get("/readings/payments/" + name, (_req, res) =>
      res.type("js").sendFile(resolve("reading-core/payments", name))
    );
  app.get("/sandbox/card/:token", async (req, res) => {
    try {
      const order = await getSandboxCardCheckout(req.params.token);
      res
        .set({
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        })
        .type("html")
        .send(
          `<!doctype html><html lang="${order.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Karma Life Design · ${CARD_COPY[order.locale].summary}</title><link rel="stylesheet" href="/readings/site.css"></head><body data-mode="vedic"><main id="card-checkout" class="card-checkout wrap" aria-live="polite"></main><script type="module" src="/readings/payments/checkout.mjs"></script></body></html>`
        );
    } catch {
      res.status(404).send("Private sandbox checkout not found");
    }
  });
  app.get("/api/card-sandbox/:token", async (req, res) => {
    try {
      const data = await getSandboxCardCheckout(req.params.token);
      res
        .set("Cache-Control", "no-store")
        .json({ ...data, owner: await isOwner(req) });
    } catch {
      res.status(404).json({ error: "checkout_unavailable" });
    }
  });
  app.post("/api/card-sandbox/:token", async (req, res) => {
    try {
      const input = z
        .discriminatedUnion("action", [
          z.object({
            action: z.literal("simulate"),
            outcome: z.enum([
              "authorized",
              "settled",
              "declined",
              "expired",
              "duplicate",
            ]),
          }),
          z.object({
            action: z.literal("request_refund"),
            reason: z.string().trim().min(10).max(1000),
          }),
          z.object({
            action: z.literal("quote_refund"),
            basis: z.enum(["voluntary", "mandatory"]),
            networkMicroUsdc: z.string().regex(/^(0|[1-9]\d{0,17})$/),
          }),
          z.object({
            action: z.literal("accept_refund"),
            quoteId: z.string().uuid(),
            recipient: z.string().max(42),
            accepted: z.literal(true),
          }),
          z.object({ action: z.literal("confirm_refund") }),
        ])
        .parse(req.body);
      if (
        ["quote_refund", "confirm_refund"].includes(input.action) &&
        !(await isOwner(req))
      ) {
        res.status(403).json({ error: "owner_required" });
        return;
      }
      let data;
      if (input.action === "simulate")
        data = await simulateSandboxCard(req.params.token, input.outcome);
      else if (input.action === "request_refund")
        data = await requestSandboxCardRefund(req.params.token, input.reason);
      else if (input.action === "quote_refund")
        data = await quoteSandboxCardRefund(
          req.params.token,
          input.basis,
          input.networkMicroUsdc
        );
      else if (input.action === "accept_refund")
        data = await acceptSandboxCardRefund(req.params.token, input);
      else data = await confirmSandboxCardRefund(req.params.token);
      res
        .set("Cache-Control", "no-store")
        .json({ ...data, owner: await isOwner(req) });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error ? error.message : "sandbox_operation_failed",
      });
    }
  });
}
