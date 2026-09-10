import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_PORT || 4010);
const publicUrl = process.env.MOCK_PUBLIC_URL || `http://127.0.0.1:${port}`;
const appUrl = process.env.APP_INTERNAL_URL || "http://app:3000";
const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || "sandbox-ipn-secret";
const invoices = new Map();
const messages = [];

function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(value));
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", publicUrl);
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (
    req.method === "POST" &&
    ["/v1/invoice", "/v1/payment"].includes(url.pathname)
  ) {
    const input = await body(req),
      id = `sandbox-${randomUUID()}`;
    invoices.set(id, input);
    return json(res, 201, {
      id,
      payment_id: Date.now(),
      payment_status: "waiting",
      invoice_url: `${publicUrl}/checkout?id=${encodeURIComponent(id)}`,
      price_amount: input.price_amount,
      price_currency: input.price_currency,
      order_id: input.order_id,
    });
  }
  if (url.pathname === "/checkout") {
    const id = url.searchParams.get("id") || "";
    const invoice = invoices.get(id);
    if (!invoice) {
      res.writeHead(404);
      return res.end("Unknown sandbox invoice");
    }
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    return res.end(
      `<!doctype html><meta name="robots" content="noindex"><title>Sandbox checkout</title><main><h1>Sandbox payment — no funds move</h1><p>Order <strong>${invoice.order_id}</strong></p><button id="confirm">Confirm test payment</button><pre id="result"></pre></main><script>confirm.onclick=async()=>{const r=await fetch('/confirm?id=${encodeURIComponent(id)}',{method:'POST'});result.textContent=await r.text();if(r.ok)setTimeout(()=>location.href=${JSON.stringify(invoice.success_url)},400)}</script>`
    );
  }
  if (req.method === "POST" && url.pathname === "/confirm") {
    const id = url.searchParams.get("id") || "",
      invoice = invoices.get(id);
    if (!invoice) return json(res, 404, { error: "unknown invoice" });
    const payload = {
      order_id: invoice.order_id,
      payment_id: Date.now(),
      payment_status: "confirmed",
    };
    const signature = createHmac("sha512", ipnSecret)
      .update(stable(payload))
      .digest("hex");
    const callback = new URL(invoice.ipn_callback_url);
    const target = `${appUrl}${callback.pathname}${callback.search}`;
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nowpayments-sig": signature,
      },
      body: JSON.stringify(payload),
    });
    return json(res, response.ok ? 200 : 502, {
      confirmed: response.ok,
      provider: "local-mock",
      fundsTransferred: false,
    });
  }
  if (req.method === "POST" && url.pathname === "/emails") {
    const message = {
      id: `email-${randomUUID()}`,
      receivedAt: new Date().toISOString(),
      ...(await body(req)),
    };
    messages.push(message);
    return json(res, 200, { id: message.id });
  }
  if (url.pathname === "/messages")
    return json(res, 200, {
      data: messages.map(({ attachments, ...message }) => ({
        ...message,
        attachmentCount: attachments?.length || 0,
      })),
    });
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    const input = await body(req);
    const text =
      input.messages?.map(message => message.content).join("\n") || "";
    const locale = /locale (ru|en|de|es)/.exec(text)?.[1] || "en";
    const titles = {
      en: "Core themes",
      ru: "Основные темы",
      de: "Zentrale Themen",
      es: "Temas principales",
    };
    const paragraphs = {
      en: "The first planetary position is offered as a reflective starting point.",
      ru: "Первое положение планеты предлагается как отправная точка для размышления.",
      de: "Die erste Planetenposition dient als Ausgangspunkt zur Reflexion.",
      es: "La primera posición planetaria sirve como punto de partida para la reflexión.",
    };
    const content = JSON.stringify({
      schemaVersion: "vedic-narrative.v1",
      locale,
      sections: [
        {
          sectionKey: "core-themes",
          title: titles[locale],
          paragraphs: [paragraphs[locale]],
          factRefs: ["planets[0].longitude"],
          warnings: ["Sandbox-generated narrative"],
        },
      ],
      disclaimerKey: "interpretive-practice",
      modelVersion: "sandbox-mock",
      promptVersion: "report-narrative-v1",
    });
    return json(res, 200, { choices: [{ message: { content } }] });
  }
  if (url.pathname === "/maps/api/geocode/json")
    return json(res, 200, {
      status: "OK",
      results: [
        {
          formatted_address: "Berlin, Germany",
          geometry: {
            location: { lat: 52.52, lng: 13.405 },
            location_type: "GEOMETRIC_CENTER",
          },
        },
      ],
    });
  if (url.pathname === "/maps/api/timezone/json")
    return json(res, 200, {
      status: "OK",
      timeZoneId: "Europe/Berlin",
      rawOffset: 3600,
      dstOffset: 0,
    });
  json(res, 404, { error: "sandbox endpoint not found", path: url.pathname });
}).listen(port, "0.0.0.0", () =>
  console.info(`Sandbox mock server listening on ${port}`)
);
