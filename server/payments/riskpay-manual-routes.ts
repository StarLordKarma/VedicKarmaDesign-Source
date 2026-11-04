import type { Express, Request } from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { createRateLimit } from "../observability";
import {
  acceptManualRiskPayPayment,
  getManualRiskPayDetail,
  getManualRiskPayPublic,
  listManualRiskPayOrders,
  manualRiskPayFunds,
  recordManualRiskPayCallback,
  requestManualRiskPayRefund,
  sendManualRiskPayPdf,
  setManualRiskPayTransactions,
  startManualRiskPayWorker,
  verifyManualRiskPayOrder,
} from "./riskpay-manual";
async function owner(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.role === "admin" &&
      ENV.ownerOpenId &&
      user.openId === ENV.ownerOpenId
      ? user
      : null;
  } catch {
    return null;
  }
}
const id = z.coerce.number().int().positive().max(2147483647);
const review = { reviewHash: z.string().regex(/^[a-f0-9]{64}$/), typedId: id };
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify") }),
  z.object({
    action: z.literal("transactions"),
    txid_in: z.string().regex(/^0x[a-f0-9]{64}$/i),
    txid_out: z.string().regex(/^0x[a-f0-9]{64}$/i),
    value_coin: z.string().regex(/^\d+(\.\d{1,6})?$/),
  }),
  z.object({
    action: z.literal("prepare"),
    ...review,
    note: z.string().trim().min(10).max(1000),
    checked: z.literal(true),
  }),
  z.object({
    action: z.literal("send"),
    ...review,
    email: z.email().max(320),
    versionId: id,
    checked: z.literal(true),
  }),
]);
const shell = (ownerPage: boolean) =>
  `<!doctype html><html lang="${ownerPage ? "ru" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Karma Life Design · ${ownerPage ? "Проверка RiskPay" : "Order"}</title><link rel="stylesheet" href="/readings/site.css"><link rel="stylesheet" href="/readings/payments/manual.css"></head><body data-mode="vedic"><main class="manual-payment wrap"><a href="${ownerPage ? "/admin/control" : "/"}">← Karma Life Design</a><h1>${ownerPage ? "Проверка оплаты и отправка PDF" : "Karma Life Design"}</h1><p id="manual-feedback" role="status" aria-live="polite"></p><div id="manual-root"></div><script type="module" src="/readings/payments/${ownerPage ? "manual-owner" : "manual-order"}.mjs"></script></main></body></html>`;
export function registerManualRiskPayRoutes(app: Express) {
  for (const name of [
    "manual-owner.mjs",
    "manual-order.mjs",
    "manual-copy.mjs",
    "manual.css",
  ])
    app.get("/readings/payments/" + name, (_req, res) =>
      res.sendFile(resolve("reading-core/payments", name))
    );
  app.use(
    "/api/riskpay-manual",
    createRateLimit({ name: "riskpay-manual", windowMs: 60000, max: 45 })
  );
  app.use(
    "/api/riskpay-order",
    createRateLimit({ name: "riskpay-order", windowMs: 60000, max: 45 })
  );
  app.use(
    [
      "/owner/riskpay",
      "/card-order",
      "/api/riskpay-order",
      "/api/riskpay-manual",
    ],
    (_req, res, next) => {
      res.set({
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex,nofollow",
        "Referrer-Policy": "no-referrer",
      });
      next();
    }
  );
  app.get("/owner/riskpay", async (req, res) => {
    if (!(await owner(req)))
      return void res
        .status(403)
        .type("html")
        .send('<a href="/owner-login">Войти как владелец</a>');
    res.type("html").send(shell(true));
  });
  app.get("/card-order/:token", async (req, res) => {
    try {
      await getManualRiskPayPublic(req.params.token);
      res.type("html").send(shell(false));
    } catch {
      res.status(404).send("Private order not found");
    }
  });
  app.get("/api/riskpay-order/:token", async (req, res) => {
    try {
      res.json(await getManualRiskPayPublic(req.params.token));
    } catch {
      res.status(404).json({ error: "order_unavailable" });
    }
  });
  app.post("/api/riskpay-order/:token/refund", async (req, res) => {
    try {
      const { reason } = z
        .object({ reason: z.string().trim().min(10).max(1000) })
        .parse(req.body);
      await requestManualRiskPayRefund(req.params.token, reason);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: "refund_request_unavailable" });
    }
  });
  app.get("/api/riskpay-manual/callback", async (req, res) => {
    try {
      const key = z
        .object({ order: id, token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(req.query);
      await recordManualRiskPayCallback(key.order, key.token, req.query);
      res.status(202).json({ status: "received_for_verification" });
    } catch {
      res.status(400).json({ error: "unverified_callback" });
    }
  });
  app.get("/api/riskpay-manual/orders", async (req, res) => {
    if (!(await owner(req)))
      return void res.status(403).json({ error: "owner_required" });
    try {
      res.json({
        orders: await listManualRiskPayOrders(),
        funds: await manualRiskPayFunds(),
      });
    } catch {
      res.status(503).json({ error: "queue_unavailable" });
    }
  });
  app.get("/api/riskpay-manual/orders/:id", async (req, res) => {
    if (!(await owner(req)))
      return void res.status(403).json({ error: "owner_required" });
    try {
      res.json(await getManualRiskPayDetail(id.parse(req.params.id)));
    } catch {
      res.status(404).json({ error: "order_unavailable" });
    }
  });
  app.post("/api/riskpay-manual/orders/:id", async (req, res) => {
    const user = await owner(req);
    if (!user) return void res.status(403).json({ error: "owner_required" });
    if (
      req.header("x-kld-owner") !== "1" ||
      (req.header("origin") &&
        req.header("origin") !== new URL(process.env.PUBLIC_BASE_URL!).origin)
    )
      return void res.status(403).json({ error: "same_origin_required" });
    try {
      const key = id.parse(req.params.id),
        input = action.parse(req.body);
      if (input.action === "verify") await verifyManualRiskPayOrder(key);
      else if (input.action === "transactions")
        await setManualRiskPayTransactions(key, input, user.openId);
      else if (input.action === "prepare")
        await acceptManualRiskPayPayment({
          id: key,
          ...input,
          actor: user.openId,
        });
      else
        await sendManualRiskPayPdf({ id: key, ...input, actor: user.openId });
      res.json(await getManualRiskPayDetail(key));
    } catch (error) {
      res
        .status(409)
        .json({
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "review_required",
        });
    }
  });
  startManualRiskPayWorker();
}
