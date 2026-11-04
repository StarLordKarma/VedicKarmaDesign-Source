import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { sign } from "node:crypto";
import mysql from "mysql2/promise";
import { assertCardSandbox } from "../server/payments/card-sandbox-config.ts";
import { canonical, hash } from "../deploy/riskpay-relay/lib/relay.mjs";
config({ path: ".env.card-sandbox", override: true, quiet: true });
assertCardSandbox();
if (
  process.env.RISKPAY_MODE !== "fixture" ||
  process.env.RISKPAY_LIVE_ENABLED !== "false"
)
  throw Error("Relay is restricted to offline fixture payments");
export async function syncRelay(publicBase) {
  const base = new URL(publicBase);
  if (
    base.protocol !== "https:" ||
    !/^[a-z0-9-]+\.netlify\.app$/.test(base.hostname) ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password ||
    base.port
  )
    throw Error("Expected isolated Netlify HTTPS root");
  const healthResponse = await fetch(new URL("/health", base), {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!healthResponse.ok) throw Error("Test receiver unavailable or expired");
  const health = await healthResponse.json();
  if (
    health.mode !== "fixture" ||
    health.livePayments !== false ||
    !health.queued ||
    !Number.isSafeInteger(health.expiresAt) ||
    health.expiresAt <= Date.now()
  )
    throw Error("Not a fixture receiver");
  const privateKey = await readFile(
    ".validation/riskpay-relay-key.pem",
    "utf8"
  );
  async function call(path, data) {
    const body = JSON.stringify(data),
      timestamp = String(Date.now());
    const signature = sign(
      null,
      Buffer.from(canonical(path, timestamp, body)),
      privateKey
    ).toString("base64");
    const r = await fetch(new URL(path, base), {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-relay-timestamp": timestamp,
        "x-relay-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Error(
        "Signed relay operation failed: " + path + " (" + r.status + ")"
      );
    return r.json();
  }
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    // Only synthetic orders explicitly bound to THIS receiver may be registered.
    const [rows] = await db.query(
      "SELECT id,priceSnapshotJson FROM booking_requests ORDER BY id DESC LIMIT 100"
    );
    const orders = new Map();
    function boundToken(row) {
      if (!row) return;
      const card = JSON.parse(row.priceSnapshotJson || "{}").cardSandbox;
      if (card?.riskpay?.mode !== "fixture" || !card.riskpay.callbackUrl)
        return;
      const callback = new URL(card.riskpay.callbackUrl);
      if (callback.origin !== base.origin) return;
      const token = callback.searchParams.get("token");
      if (
        !/^[a-f0-9]{64}$/.test(token || "") ||
        callback.searchParams.get("order") !== String(row.id)
      )
        return;
      return { token, card };
    }
    for (const row of rows) {
      const bound = boundToken(row);
      if (!bound) continue;
      const { token, card } = bound;
      orders.set(String(row.id), token);
      await call("/internal/register", {
        order: String(row.id),
        tokenHash: hash(token),
        address: card.riskpay.wallet.assignedAddress,
        expiresAt: health.expiresAt,
      });
    }
    const { events } = await call("/internal/events", {});
    let delivered = 0,
      deferred = 0;
    for (const item of events) {
      const order = String(item.event?.order);
      if (!/^[1-9]\d{0,9}$/.test(order)) {
        deferred++;
        continue;
      }
      let token = orders.get(order);
      if (!token) {
        // A delayed callback may belong to an order older than the latest 100.
        const [older] = await db.execute(
          "SELECT id,priceSnapshotJson FROM booking_requests WHERE id=?",
          [order]
        );
        token = boundToken(older[0])?.token;
      }
      if (!token || !/^events\/[a-f0-9]{64}$/.test(item.key)) continue;
      try {
        const params = new URLSearchParams({ ...item.event, token });
        const local = new URL(
          "/api/riskpay/callback",
          process.env.PUBLIC_BASE_URL
        );
        local.search = params.toString();
        const response = await fetch(local, {
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        if (response.status !== 202)
          throw Error("Local sandbox rejected queued notification");
        const ack = await response.json();
        if (ack.accepted !== true || typeof ack.paid !== "boolean")
          throw Error("Unexpected local callback response");
        await call("/internal/ack", { key: item.key });
        delivered++;
      } catch {
        // Keep the event unacked for retry; one failed order must not block others.
        deferred++;
      }
    }
    return { registered: orders.size, delivered, deferred };
  } finally {
    await db.end();
  }
}
if (process.argv[1]?.endsWith("/riskpay-relay-local.mjs")) {
  const base = process.argv[2];
  console.log(JSON.stringify(await syncRelay(base)));
}
