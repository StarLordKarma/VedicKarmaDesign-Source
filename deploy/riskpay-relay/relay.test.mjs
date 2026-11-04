import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createRelay, canonical, hash } from "./lib/relay.mjs";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const now = 1804262400000,
  expiresAt = now + 3600000;
function setup() {
  const entries = new Map();
  const store = {
    async get(k, { type } = {}) {
      const v = entries.get(k);
      return v
        ? type === "json"
          ? structuredClone(v)
          : JSON.stringify(v)
        : null;
    },
    async setJSON(k, v, { onlyIfNew } = {}) {
      if (!onlyIfNew || !entries.has(k)) entries.set(k, structuredClone(v));
    },
    async delete(k) {
      entries.delete(k);
    },
    async *list({ prefix }) {
      yield {
        blobs: [...entries.keys()]
          .filter(k => k.startsWith(prefix))
          .map(key => ({ key })),
      };
    },
  };
  const relay = createRelay({ store, publicKey, expiresAt, now: () => now });
  function signed(path, data, time = now) {
    const body = JSON.stringify(data),
      timestamp = String(time);
    return new Request("https://test.invalid" + path, {
      method: "POST",
      body,
      headers: {
        "x-relay-timestamp": timestamp,
        "x-relay-signature": sign(
          null,
          Buffer.from(canonical(path, timestamp, body)),
          privateKey
        ).toString("base64"),
      },
    });
  }
  const token = "a".repeat(64),
    address = "0x" + "1".repeat(40);
  const params = new URLSearchParams({
    order: "7",
    token,
    address_in: address,
    coin: "polygon_usdc",
    value_coin: "4.99",
    txid_in: "0x" + "b".repeat(64),
    txid_out: "0x" + "c".repeat(64),
  });
  const callback = () =>
    new Request("https://test.invalid/api/riskpay/callback?" + params);
  const register = () =>
    relay(
      signed("/internal/register", {
        order: "7",
        tokenHash: hash(token),
        address,
        expiresAt,
      })
    );
  return { relay, entries, signed, params, callback, register };
}
test("health exposes fixture mode; app and internal data are closed", async () => {
  const { relay } = setup();
  assert.equal(
    (await (await relay(new Request("https://x/health"))).json()).livePayments,
    false
  );
  for (const path of [
    "/",
    "/admin",
    "/.env",
    "/api/trpc/booking.submit",
    "/.netlify/functions/receiver",
  ])
    assert.equal((await relay(new Request("https://x" + path))).status, 404);
  for (const path of [
    "/internal/register",
    "/internal/events",
    "/internal/ack",
  ])
    assert.equal(
      (
        await relay(
          new Request("https://x" + path, { method: "POST", body: "{}" })
        )
      ).status,
      401
    );
});
test("unregistered, forged capability, wrong wallet and duplicate parameters rejected", async () => {
  const s = setup();
  assert.equal((await s.relay(s.callback())).status, 400);
  assert.equal((await s.register()).status, 200);
  s.params.set("token", "0".repeat(64));
  assert.equal((await s.relay(s.callback())).status, 400);
  s.params.set("token", "a".repeat(64));
  s.params.set("address_in", "0x" + "2".repeat(40));
  assert.equal((await s.relay(s.callback())).status, 400);
  s.params.set("address_in", "0x" + "1".repeat(40));
  s.params.append("coin", "polygon_usdc");
  assert.equal((await s.relay(s.callback())).status, 400);
});
test("event persists without raw capability; retries and acknowledged replays never create another event", async () => {
  const s = setup();
  await s.register();
  assert.deepEqual(await (await s.relay(s.callback())).json(), {
    accepted: true,
    paid: false,
    mode: "fixture",
  });
  await s.relay(s.callback());
  const reordered = new URLSearchParams([...s.params].reverse());
  reordered.set("value_coin", "04.990000");
  reordered.set("txid_in", "0x" + "B".repeat(64));
  await s.relay(
    new Request("https://test.invalid/api/riskpay/callback?" + reordered)
  );
  let result = await (await s.relay(s.signed("/internal/events", {}))).json();
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].event.token, undefined);
  const key = result.events[0].key;
  assert.equal((await s.relay(s.signed("/internal/ack", { key }))).status, 200);
  await s.relay(s.callback());
  await s.relay(
    new Request("https://test.invalid/api/riskpay/callback?" + reordered)
  );
  result = await (await s.relay(s.signed("/internal/events", {}))).json();
  assert.equal(result.events.length, 0);
  assert.ok(!JSON.stringify([...s.entries.values()]).includes("a".repeat(64)));
});
test("expired signatures, tampered payloads, conflicting registration and arbitrary deletion rejected", async () => {
  const s = setup();
  assert.equal(
    (await s.relay(s.signed("/internal/events", {}, now - 120001))).status,
    401
  );
  const signed = s.signed("/internal/events", {});
  assert.equal(
    (
      await s.relay(
        new Request(signed.url, {
          method: "POST",
          headers: signed.headers,
          body: '{"tampered":true}',
        })
      )
    ).status,
    401
  );
  await s.register();
  assert.equal(
    (
      await s.relay(
        s.signed("/internal/register", {
          order: "7",
          tokenHash: "0".repeat(64),
          address: "0x" + "1".repeat(40),
          expiresAt,
        })
      )
    ).status,
    409
  );
  assert.equal(
    (await s.relay(s.signed("/internal/ack", { key: "orders/7" }))).status,
    400
  );
});
test("receiver closes completely at expiration and rejects malformed callback method", async () => {
  const { relay } = setup();
  assert.equal(
    (
      await relay(
        new Request("https://x/api/riskpay/callback", { method: "POST" })
      )
    ).status,
    405
  );
  assert.equal(
    (await relay(new Request("https://x/api/riskpay/callback"))).status,
    400
  );
  const expired = createRelay({
    store: {},
    publicKey,
    expiresAt,
    now: () => expiresAt,
  });
  assert.equal((await expired(new Request("https://x/health"))).status, 410);
});
