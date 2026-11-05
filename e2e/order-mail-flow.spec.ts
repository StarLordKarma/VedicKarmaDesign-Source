import { test, expect } from "@playwright/test";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";
import {
  assertCardSandbox,
  cardSandboxEnabled,
} from "../server/payments/card-sandbox-config";
import {
  manualDigest,
  manualOrderIdentity,
} from "../server/payments/riskpay-manual-policy";
import { POLYGON_NATIVE_USDC } from "../server/payments/riskpay-settlement";
test.skip(
  !cardSandboxEnabled(),
  "Only isolated local database, storage and email simulator"
);
test.use({ channel: "chrome", video: "off" });
test.setTimeout(240_000);
const headers = { "x-kld-owner": "1" };
const unwrap = async (r: any) => {
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).result.data.json;
};
async function fixture(request: any) {
  assertCardSandbox();
  const booking = await unwrap(
    await request.post("/api/trpc/booking.submit", {
      data: {
        json: {
          name: "Synthetic Manual Natal Client",
          email: "manual-" + crypto.randomUUID() + "@sandbox.invalid",
          language: "Русский",
          product: "vedic_basic",
          birthDate: "1990-01-01",
          birthTime: "12:00",
          birthCity: "Berlin",
          birthCountry: "Germany",
          currentZone: "Europe/Berlin",
          disambiguation: "reject",
          unknownTime: false,
          addon: false,
          currency: "USD",
          privacyAcknowledged: true,
          privacyNoticeVersion: "privacy-2026-10-21",
          privacyLocale: "ru",
          paymentMethod: "card",
          cardBrand: "visa",
          cardRefundConsent: true,
          orderRecommendations: true,
          cardTermsVersion: "card-manual-refund-2026-11-03",
        },
      },
    })
  );
  const db = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows]: any = await db.execute(
    "select * from booking_requests where id=?",
    [booking.id]
  );
  const row = rows[0],
    price = JSON.parse(row.priceSnapshotJson);
  delete price.cardSandbox;
  row.priceSnapshotJson = JSON.stringify(price);
  const secret = randomBytes(32).toString("hex");
  const card = {
    version: 1,
    identityHash: manualDigest(manualOrderIdentity(row)),
    tokenHash: manualDigest(secret),
    callbackHash: manualDigest(randomBytes(32).toString("hex")),
    createdAt: Date.now(),
    locale: "ru",
    method: "card",
    merchantWallet: "0x" + "1".repeat(40),
    wallet: {
      assignedAddress: "0x" + "2".repeat(40),
      encryptedAddress: "offline-fixture-only",
      ipnToken: "offline-fixture-only",
    },
    consent: {
      version: "synthetic-manual-fixture",
      text: "Synthetic test consent. No real card charge, transfer or customer.",
      at: new Date().toISOString(),
    },
    receipt: {
      claim: "manual-e2e:" + booking.id,
      incomingMicroUsdc: "9990000",
      merchantMicroUsdc: "8300000",
      txidIn: "0x" + "a".repeat(64),
      txidOut: "0x" + "b".repeat(64),
      receivedAt: Date.now(),
      token: POLYGON_NATIVE_USDC,
      chainId: "0x89",
    },
  };
  price.riskpayManual = card;
  await db.execute(
    "update booking_requests set paymentId=?,paymentStatus=?,priceSnapshotJson=? where id=?",
    [
      "riskpay-manual:" + booking.id,
      "received_review",
      JSON.stringify(price),
      booking.id,
    ]
  );
  return { id: booking.id, email: row.email, db, secret };
}
test("owner sees exact natal order/payment/recipient; two explicit approvals, one job and one email", async ({
  page,
  request,
}) => {
  const s = await fixture(request),
    url = "/api/riskpay-manual/orders/" + s.id;
  try {
    expect((await request.get(url)).status()).toBe(403);
    expect(
      (
        await request.post(url, {
          headers,
          data: {
            action: "prepare",
            reviewHash: "a".repeat(64),
            typedId: s.id,
            note: "Synthetic owner acceptance",
            checked: true,
          },
        })
      ).status()
    ).toBe(403);
    const pub = await (
      await request.get("/api/riskpay-order/" + s.id + "." + s.secret)
    ).json();
    expect(pub.received).toBe(true);
    expect(JSON.stringify(pub)).not.toContain(s.email);
    expect(pub.accepted).toBe(false);
    const [before]: any = await s.db.execute(
      "select count(*) n from report_jobs where bookingId=?",
      [s.id]
    );
    expect(before[0].n).toBe(0);
    await page.goto(
      "/api/auth/login?token=sandbox-login-token-change-me-32-characters"
    );
    await page.goto("/owner/riskpay?order=" + s.id);
    await expect(
      page.getByText("Кому отправится PDF", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(s.email, { exact: true })).toBeVisible();
    await expect(page.getByText("1990-01-01 · 12:00")).toBeVisible();
    await expect(
      page.getByText("8.300000 USDC", { exact: true })
    ).toBeVisible();
    const api = page.request;
    const d = await (await api.get(url)).json();
    const body = {
      action: "prepare",
      reviewHash: d.reviewHash,
      typedId: s.id,
      note: "Accept verified synthetic USDC receipt for this exact natal order",
      checked: true,
    };
    expect(
      (
        await api.post(url, { headers, data: { ...body, typedId: s.id + 1 } })
      ).status()
    ).toBe(409);
    expect(
      (
        await api.post(url, { headers, data: { ...body, checked: false } })
      ).status()
    ).toBe(409);
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => api.post(url, { headers, data: body }))
    );
    expect(responses.filter(r => r.ok())).toHaveLength(1);
    await expect
      .poll(
        async () => {
          const d = await (await api.get(url)).json();
          return d.job?.status;
        },
        { timeout: 90000, intervals: [1000, 2000, 3000] }
      )
      .toBe("needs_review");
    const ready = await (await api.get(url)).json();
    const preview = await api.get(ready.version.previewUrl);
    expect(preview.ok()).toBe(true);
    const pdfBytes = await preview.body();
    expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(pdfBytes).digest("hex")).toBe(
      ready.version.pdfSha256
    );
    const [jobs]: any = await s.db.execute(
      "select count(*) n from report_jobs where bookingId=?",
      [s.id]
    );
    expect(jobs[0].n).toBe(1);
    expect(ready.attempts).toHaveLength(0);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Открыть именно эту версию PDF ↗" })
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/manual-riskpay-owner-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/manual-riskpay-owner-mobile.png",
      fullPage: true,
    });
    const send = {
      action: "send",
      reviewHash: ready.reviewHash,
      typedId: s.id,
      email: s.email,
      versionId: ready.version.id,
      checked: true,
    };
    expect(
      (
        await api.post(url, {
          headers,
          data: { ...send, email: "wrong@sandbox.invalid" },
        })
      ).status()
    ).toBe(409);
    expect(
      (
        await api.post(url, {
          headers,
          data: { ...send, versionId: ready.version.id + 1 },
        })
      ).status()
    ).toBe(409);
    const flowBefore = await (await api.get("/api/owner/order-flow")).json();
    const flowRow = flowBefore.orders.find((o: any) => o.id === s.id);
    expect(flowRow.flow.locale).toBe("ru");
    expect(flowRow.flow.delaySeconds).toBeGreaterThanOrEqual(1200);
    expect(flowRow.flow.delaySeconds).toBeLessThanOrEqual(2400);
    const sends = await Promise.all(
      Array.from({ length: 5 }, () => api.post(url, { headers, data: send }))
    );
    expect(sends.some(r => r.ok())).toBe(true);
    await expect
      .poll(async () => (await (await api.get(url)).json()).job?.status)
      .toBe("approved");
    await expect
      .poll(
        async () => {
          const [r]: any = await s.db.execute(
            "select ackState from order_mail_flows where bookingId=?",
            [s.id]
          );
          return r[0]?.ackState;
        },
        { timeout: 60000 }
      )
      .toBe("accepted");
    const [flows]: any = await s.db.execute(
      "select * from order_mail_flows where bookingId=?",
      [s.id]
    );
    expect(flows).toHaveLength(1);
    expect(flows[0].providerMessageId).toBeTruthy();
    expect(flows[0].ackPayload).not.toMatch(/mailto:|support@/);
    expect(
      new Date(flows[0].dueAt).getTime() -
        new Date(flows[0].ackAcceptedAt).getTime()
    ).toBe(flows[0].delaySeconds * 1000);
    const beforeDue = await (await api.get(url)).json();
    expect(beforeDue.attempts).toHaveLength(0);
    const pub2 = await (
      await request.get("/api/riskpay-order/" + s.id + "." + s.secret)
    ).json();
    const clientToken = JSON.parse(flows[0].ackPayload).text.match(
      /\/status\/([A-Za-z0-9_-]{32,100})/
    )[1];
    expect(
      (await request.get("/api/client/report/" + clientToken)).status()
    ).toBe(404);
    // Isolated MySQL sandbox only: simulate elapsed wall-clock time without weakening production configuration.
    await s.db.execute(
      "update order_mail_flows set acceptedAt=DATE_SUB(NOW(), INTERVAL (delaySeconds+2) SECOND),ackAcceptedAt=DATE_SUB(NOW(), INTERVAL (delaySeconds+1) SECOND),dueAt=DATE_SUB(NOW(), INTERVAL 1 SECOND) where bookingId=?",
      [s.id]
    );
    await expect
      .poll(
        async () => {
          const [rows]: any = await s.db.execute(
            "select status from report_jobs where bookingId=? order by id desc limit 1",
            [s.id]
          );
          return rows[0]?.status;
        },
        { timeout: 60000, intervals: [2000, 4000] }
      )
      .toBe("sent");
    const sent = await (await api.get(url)).json();
    expect(sent.attempts).toHaveLength(1);
    expect(sent.attempts[0].recipient).toBe(s.email);
    expect(sent.attempts[0].status).toBe("sent");
    expect(sent.attempts[0].providerMessageId).toBeTruthy();
    const recorded = await (
      await request.get("http://127.0.0.1:4012/messages")
    ).json();
    const letters = recorded.data.filter((m: any) => m.to.includes(s.email));
    expect(letters).toHaveLength(2);
    expect(letters[0].subject).toContain("принят в работу");
    expect(letters[0].attachmentCount).toBe(0);
    expect(letters[0].html).not.toMatch(/mailto:|свяжитесь/i);
    expect(letters[1].attachmentCount).toBe(1);
    expect(letters[1].html).toContain("Другие виды чтений");
    expect(letters[1].html).toContain("reading_history=");

    expect((await api.post(url, { headers, data: send })).status()).toBe(409);
    await page.goto("/owner/order-flow");
    await expect(
      page.getByText("Этапы обработки заказов", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Адресат первого письма:", { exact: true }).first()
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "artifacts/order-flow-owner-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/order-flow-owner-mobile.png",
      fullPage: true,
    });
  } finally {
    await s.db.end();
  }
});
test("changed recipient invalidates owner review and prevents preparation; refund request pauses new work", async ({
  page,
  request,
}) => {
  const s = await fixture(request),
    url = "/api/riskpay-manual/orders/" + s.id;
  try {
    await page.goto(
      "/api/auth/login?token=sandbox-login-token-change-me-32-characters"
    );
    const api = page.request;
    const before = await (await api.get(url)).json();
    await s.db.execute("update booking_requests set email=? where id=?", [
      "changed@sandbox.invalid",
      s.id,
    ]);
    const rejected = await api.post(url, {
      headers,
      data: {
        action: "prepare",
        reviewHash: before.reviewHash,
        typedId: s.id,
        note: "Synthetic acceptance attempt on a stale tab",
        checked: true,
      },
    });
    expect(rejected.status()).toBe(409);
    const changed = await (await api.get(url)).json();
    expect(changed.changed).toBe(true);
    expect(
      (
        await api.post(url, {
          headers,
          data: {
            action: "prepare",
            reviewHash: changed.reviewHash,
            typedId: s.id,
            note: "Synthetic attempt despite changed recipient",
            checked: true,
          },
        })
      ).status()
    ).toBe(409);
    expect(
      (
        await request.post(
          "/api/riskpay-order/" + s.id + "." + s.secret + "/refund",
          { data: { reason: "Synthetic refund request, no transfer" } }
        )
      ).ok()
    ).toBe(true);
    const held = await (await api.get(url)).json();
    expect(held.payment).toBe("refund_pending");
    expect(held.preparation).toBeNull();
    const [jobs]: any = await s.db.execute(
      "select count(*) n from report_jobs where bookingId=?",
      [s.id]
    );
    expect(jobs[0].n).toBe(0);
  } finally {
    await s.db.end();
  }
});
