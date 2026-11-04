import { createHash, verify } from "node:crypto";
export const hash = value => createHash("sha256").update(value).digest("hex");
export const canonical = (path, timestamp, body) =>
  `POST\n${path}\n${timestamp}\n${hash(body)}`;
const patterns = {
  order: /^[1-9]\d{0,9}$/,
  token: /^[a-f0-9]{64}$/,
  value_coin: /^\d{1,15}(\.\d{1,6})?$/,
  coin: /^polygon_usdc$/,
  txid_in: /^0x[0-9a-fA-F]{64}$/,
  txid_out: /^0x[0-9a-fA-F]{64}$/,
  address_in: /^0x[0-9a-fA-F]{40}$/,
};
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
/** Test notifications only. Never stores balances, customer details or raw order capabilities. */
export function createRelay({ store, publicKey, expiresAt, now = Date.now }) {
  return async req => {
    const url = new URL(req.url),
      path = url.pathname;
    if (
      ![
        "/health",
        "/api/riskpay/callback",
        "/internal/register",
        "/internal/events",
        "/internal/ack",
      ].includes(path)
    )
      return json(404, { error: "not_found" });
    if (now() >= expiresAt) return json(410, { error: "test_contour_expired" });
    if (path === "/health")
      return req.method === "GET" && !url.search
        ? json(200, {
            service: "riskpay-callback-sandbox",
            mode: "fixture",
            livePayments: false,
            queued: true,
            expiresAt,
          })
        : json(405, { error: "method_not_allowed" });
    if (path === "/api/riskpay/callback") {
      if (req.method !== "GET")
        return json(405, { error: "method_not_allowed" });
      const keys = [...url.searchParams.keys()],
        p = Object.fromEntries(url.searchParams);
      if (
        req.url.length > 2048 ||
        req.body ||
        keys.length !== 7 ||
        new Set(keys).size !== 7 ||
        Object.entries(patterns).some(([k, re]) => !re.test(p[k] || ""))
      )
        return json(400, { error: "invalid_callback" });
      const registration = await store.get("orders/" + p.order, {
        type: "json",
      });
      if (
        !registration ||
        registration.expiresAt <= now() ||
        registration.tokenHash !== hash(p.token) ||
        registration.address.toLowerCase() !== p.address_in.toLowerCase()
      )
        return json(400, { error: "unverified_callback" });
      // Canonical field order, address/hash casing and amount representation:
      // providers can reorder URL parameters on retries without creating events.
      const [whole, fraction = ""] = p.value_coin.split(".");
      const micro = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
      const event = {
        order: p.order,
        value_coin: `${micro / 1000000n}.${(micro % 1000000n).toString().padStart(6, "0")}`,
        coin: p.coin,
        txid_in: p.txid_in.toLowerCase(),
        txid_out: p.txid_out.toLowerCase(),
        address_in: p.address_in.toLowerCase(),
      };
      const key = "events/" + hash(JSON.stringify(event));
      // Immutable event and immutable ack prevent duplicate delivery after an ack.
      if (!(await store.get("acks/" + key.slice(7))))
        await store.setJSON(
          key,
          { key, event, receivedAt: now() },
          { onlyIfNew: true }
        );
      return json(202, { accepted: true, paid: false, mode: "fixture" });
    }
    if (req.method !== "POST")
      return json(405, { error: "method_not_allowed" });
    if (url.search || Number(req.headers.get("content-length") || 0) > 4096)
      return json(400, { error: "invalid_request" });
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { error: "body_too_large" });
    const timestamp = req.headers.get("x-relay-timestamp") || "";
    const signature = req.headers.get("x-relay-signature") || "";
    let valid = false;
    try {
      valid =
        /^\d{13}$/.test(timestamp) &&
        Math.abs(now() - Number(timestamp)) < 120000 &&
        /^[A-Za-z0-9+/]{86}==$/.test(signature) &&
        verify(
          null,
          Buffer.from(canonical(path, timestamp, raw)),
          publicKey,
          Buffer.from(signature, "base64")
        );
    } catch {
      /* Generic response never discloses keys or verification details. */
    }
    if (!valid) return json(401, { error: "unauthorized" });
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (path === "/internal/register") {
      if (
        !data ||
        !patterns.order.test(String(data.order)) ||
        !patterns.token.test(data.tokenHash || "") ||
        !patterns.address_in.test(data.address || "") ||
        !Number.isSafeInteger(data.expiresAt) ||
        data.expiresAt <= now() ||
        data.expiresAt > expiresAt
      )
        return json(400, { error: "invalid_registration" });
      const item = {
        order: String(data.order),
        tokenHash: data.tokenHash,
        address: data.address,
        expiresAt: data.expiresAt,
      };
      await store.setJSON("orders/" + item.order, item, { onlyIfNew: true });
      const existing = await store.get("orders/" + item.order, {
        type: "json",
      });
      return existing.tokenHash === item.tokenHash &&
        existing.address === item.address
        ? json(200, { registered: true })
        : json(409, { error: "registration_conflict" });
    }
    if (path === "/internal/ack") {
      if (!/^events\/[a-f0-9]{64}$/.test(data?.key || ""))
        return json(400, { error: "invalid_key" });
      await store.setJSON(
        "acks/" + data.key.slice(7),
        { at: now() },
        { onlyIfNew: true }
      );
      await store.delete(data.key);
      return json(200, { acknowledged: true });
    }
    const events = [];
    for await (const page of store.list({
      prefix: "events/",
      paginate: true,
    })) {
      for (const { key } of page.blobs) {
        const event = await store.get(key, { type: "json" });
        if (event && !(await store.get("acks/" + key.slice(7))))
          events.push(event);
        if (events.length >= 50) break;
      }
      if (events.length >= 50) break;
    }
    return json(200, { events });
  };
}
