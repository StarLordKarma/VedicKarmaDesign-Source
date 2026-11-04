import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import mysql from "mysql2/promise";
import { assertCardSandbox, cardSandboxEnabled } from "../server/payments/card-sandbox-config";
test.skip(!cardSandboxEnabled(), 'Requires the isolated card sandbox and synthetic services');
test.use({ channel: "chrome", video: "off" });
const auth = "sandbox-login-token-change-me-32-characters";
const payload = (brand = "visa") => ({
  name: "Card Sandbox Client",
  email: `card-${crypto.randomUUID()}@sandbox.invalid`,
  language: "Русский",
  product: "tarot",
  addon: false,
  currency: "USD",
  privacyAcknowledged: true,
  privacyNoticeVersion: "privacy-2026-10-21",
  privacyLocale: "ru",
  paymentMethod: "card",
  cardBrand: brand,
  cardRefundConsent: true,
  cardTermsVersion: "card-manual-refund-2026-11-03",
});
const unwrap = async (r: any) => {
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).result.data.json;
};
test("card approval, durable payment, one report/email, private PDF and owner-controlled manual refund", async ({
  page,
  request,
}) => {
  const order = await unwrap(
    await request.post("/api/trpc/booking.submit", {
      data: { json: payload() },
    })
  );
  const token = order.invoiceUrl.split("/").at(-1),
    url = "/api/card-sandbox/" + token;
  await page.goto(order.invoiceUrl);
  await expect(
    page.getByText("Предпросмотр оплаты · без списаний")
  ).toBeVisible();
  const authorized = await request.post(url, {
    data: { action: "simulate", outcome: "authorized" },
  });
  expect((await authorized.json()).report).toBeNull();
  const denied = await request.post(url, {
    data: {
      action: "quote_refund",
      basis: "voluntary",
      networkMicroUsdc: "10000",
    },
  });
  expect(denied.status()).toBe(403);
  const callbackKey = order.invoiceUrl.split("/").at(-1).split(".");
  const assigned =
    "0x" +
    createHash("sha256")
      .update("riskpay-fixture:" + order.paymentId.replace("card-sandbox:", ""))
      .digest("hex")
      .slice(0, 40);
  const hint = await request.get("/api/riskpay/callback", {
    params: {
      order: callbackKey[0],
      token: callbackKey[1],
      value_coin: "4.99",
      coin: "polygon_usdc",
      txid_in: "0x" + "a".repeat(64),
      txid_out: "0x" + "b".repeat(64),
      address_in: assigned,
    },
  });
  expect(hint.status()).toBe(202);
  expect((await (await request.get(url)).json()).report).toBeNull();
  await request.post(url, { data: { action: "simulate", outcome: "settled" } });
  await expect
    .poll(
      async () => {
        const r = await request.get(url);
        return (await r.json()).report?.status;
      },
      { timeout: 90000, intervals: [1000, 2000, 4000] }
    )
    .toBe("needs_review");
  const ready = await (await request.get(url)).json();
  const jobId = ready.report.id;
  await request.get("/api/auth/login?token=" + auth);
  const job = await unwrap(
    await request.get("/api/trpc/reportStudio.getJob", {
      params: { input: JSON.stringify({ json: { reportJobId: jobId } }) },
    })
  );
  await unwrap(
    await request.post("/api/trpc/reportStudio.approve", {
      data: {
        json: {
          reportJobId: jobId,
          versionId: job.versions[0].id,
          specialistChecked: true,
        },
      },
    })
  );
  await request.post(url, {
    data: { action: "simulate", outcome: "duplicate" },
  });
  expect((await (await request.get(url)).json()).report.id).toBe(jobId);
  assertCardSandbox();
  const reserveDb = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const readReceiptTime = async () => {
      const [rows] = await reserveDb.execute<any[]>(
        "SELECT priceSnapshotJson FROM booking_requests WHERE id=?",
        [order.id]
      );
      return JSON.parse(rows[0].priceSnapshotJson).cardSandbox.fundsReceivedAt;
    };
    const receivedAt = await readReceiptTime();
    expect(receivedAt).toBeGreaterThan(0);
    await request.post(url, {
      data: { action: "simulate", outcome: "duplicate" },
    });
    expect(await readReceiptTime()).toBe(receivedAt);
  } finally {
    await reserveDb.end();
  }
  const messages = (
    await (await request.get("http://127.0.0.1:4010/messages")).json()
  ).data;
  expect(
    messages.filter(
      (m: any) => m.to?.includes(job.booking.email) && m.attachmentCount === 1
    )
  ).toHaveLength(1);
  const statusToken = ready.statusUrl.split("/").at(-1);
  const pdf = await request.get("/api/client/report/" + statusToken);
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await request.post(url, {
    data: {
      action: "request_refund",
      reason: "Please review my voluntary refund request.",
    },
  });
  let quoted = await (
    await request.post(url, {
      data: {
        action: "quote_refund",
        basis: "voluntary",
        networkMicroUsdc: "10000",
      },
    })
  ).json();
  expect(quoted.refund.quote).toMatchObject({
    grossMicroUsdc: "4990000",
    siteMicroUsdc: "998000",
    networkMicroUsdc: "10000",
    netMicroUsdc: "3982000",
  });
  await page.goto(order.invoiceUrl);
  const agreement = page.locator("input[type=checkbox]");
  await agreement.check();
  const oldQuoteId = quoted.refund.quoteId;
  quoted = await (
    await request.post(url, {
      data: {
        action: "quote_refund",
        basis: "voluntary",
        networkMicroUsdc: "10000",
      },
    })
  ).json();
  await expect(agreement).not.toBeChecked({ timeout: 10000 });
  expect(
    (
      await request.post(url, {
        data: {
          action: "accept_refund",
          quoteId: oldQuoteId,
          recipient: "0x1111111111111111111111111111111111111111",
          accepted: true,
        },
      })
    ).status()
  ).toBe(400);
  const before = await request.post(url, {
    data: { action: "confirm_refund" },
  });
  expect(before.status()).toBe(400);
  const selfRefund = await request.post(url, {
    data: {
      action: "accept_refund",
      quoteId: quoted.refund.quoteId,
      recipient: "0x1111111111111111111111111111111111111111",
      accepted: true,
    },
  });
  expect(selfRefund.status()).toBe(400);
  const accepted = await (
    await request.post(url, {
      data: {
        action: "accept_refund",
        quoteId: quoted.refund.quoteId,
        recipient: "0x2222222222222222222222222222222222222222",
        accepted: true,
      },
    })
  ).json();
  expect(accepted.status).toBe("refund_pending");
  const refundHash =
    "0x" +
    createHash("sha256")
      .update(
        "fixture-refund:" +
          order.paymentId.replace("card-sandbox:", "") +
          ":" +
          quoted.refund.quoteId
      )
      .digest("hex");
  const refundClaim = "fixture-refund:0x89:" + refundHash + ":0x0";
  const refundDb = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    // Collision is injected only in the explicitly isolated synthetic database.
    await refundDb.execute(
      "INSERT INTO verified_payment_claims (paymentId,bookingId) VALUES (?,?)",
      [refundClaim, -1]
    );
    try {
      const conflict = await request.post(url, {
        data: { action: "confirm_refund" },
      });
      expect(conflict.status()).toBe(400);
      expect((await (await request.get(url)).json()).status).toBe(
        "refund_pending"
      );
    } finally {
      await refundDb.execute(
        "DELETE FROM verified_payment_claims WHERE paymentId=? AND bookingId=-1",
        [refundClaim]
      );
    }
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        request.post(url, { data: { action: "confirm_refund" } })
      )
    );
    for (const result of attempts)
      expect((await result.json()).status).toBe("refunded");
    const [claims] = await refundDb.execute<any[]>(
      "SELECT bookingId FROM verified_payment_claims WHERE paymentId=?",
      [refundClaim]
    );
    expect(claims).toHaveLength(1);
    expect(claims[0].bookingId).toBe(order.id);
    const confirmed = await (await request.get(url)).json();
    expect(confirmed.refund.proof).toEqual({
      mode: "fixture",
      claim: refundClaim,
      transactionHash: refundHash,
    });
  } finally {
    await refundDb.end();
  }
  await request.post(url, {
    data: { action: "simulate", outcome: "duplicate" },
  });
  expect((await (await request.get(url)).json()).status).toBe("refunded");
});
test("live orders reject simulated settlements and refunds; terminal callback cannot reopen fulfillment", async ({
  request,
}) => {
  assertCardSandbox();
  const order = await unwrap(
    await request.post("/api/trpc/booking.submit", {
      data: { json: payload() },
    })
  );
  const token = order.invoiceUrl.split("/").at(-1),
    url = "/api/card-sandbox/" + token;
  const db = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await db.execute<any[]>(
    "SELECT priceSnapshotJson,status,paymentStatus FROM booking_requests WHERE id=?",
    [order.id]
  );
  const original = rows[0];
  try {
    const all = JSON.parse(original.priceSnapshotJson),
      card = all.cardSandbox;
    card.riskpay.mode = "live";
    card.status = "paid";
    const modified = JSON.stringify(all);
    await db.execute(
      "UPDATE booking_requests SET priceSnapshotJson=? WHERE id=?",
      [modified, order.id]
    );
    await request.get("/api/auth/login?token=" + auth);
    for (const data of [
      { action: "simulate", outcome: "settled" },
      { action: "quote_refund", basis: "voluntary", networkMicroUsdc: "10000" },
      { action: "confirm_refund" },
    ]) {
      const response = await request.post(url, { data });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toMatch(/Live/);
    }
    const [id, capability] = token.split(".");
    const result = await request.get("/api/riskpay/callback", {
      params: {
        order: id,
        token: capability,
        address_in: card.riskpay.wallet.assignedAddress,
        value_coin: "4.99",
        coin: "polygon_usdc",
        txid_in: "0x" + "b".repeat(64),
        txid_out: "0x" + "c".repeat(64),
      },
    });
    expect(result.status()).toBe(202);
    const [after] = await db.execute<any[]>(
      "SELECT priceSnapshotJson,status,paymentStatus FROM booking_requests WHERE id=?",
      [order.id]
    );
    expect(after[0]).toMatchObject({
      ...original,
      priceSnapshotJson: modified,
    });
  } finally {
    await db.execute(
      "UPDATE booking_requests SET priceSnapshotJson=?,status=?,paymentStatus=? WHERE id=?",
      [
        original.priceSnapshotJson,
        original.status,
        original.paymentStatus,
        order.id,
      ]
    );
    await db.end();
  }
});
test("reserve summary is owner-only and clearly identifies simulated funds", async ({
  page,
  request,
}) => {
  expect((await request.get("/sandbox/card-owner?lang=ru")).status()).toBe(403);
  await page.goto("/api/auth/login?token=" + auth);
  await page.goto("/sandbox/card-owner?lang=ru");
  await expect(
    page.getByRole("heading", { name: "Резерв из поступлений · тестовый учёт" })
  ).toBeVisible();
  await expect(
    page.getByText("Подтверждённые поступления после комиссий:")
  ).toBeVisible();
  await expect(page.getByText(/не баланс реального кошелька/)).toBeVisible();
  await expect(page.getByText(/удерживается 14 дней/)).toBeVisible();
  await expect(page.getByText("Удерживается в резерве:")).toBeVisible();
  await expect(
    page.getByText("Доступно к распределению по внутреннему учёту:")
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/card-sandbox-owner-reserve.png" });
});
for (const locale of ["en", "ru", "de", "es"])
  test(`payment selector follows the site theme and requires separate consent: ${locale}`, async ({
    page,
  }) => {
    await page.goto("/?lang=" + locale);
    await page.locator("[data-product=vedic_basic]").first().click();
    const dialog = page.locator("#order");
    await expect(dialog).toBeVisible();
    await dialog.locator("input[name=payment-method][value=card]").check();
    await expect(dialog.locator("#card-payment-details")).toBeVisible();
    await expect(dialog.locator("#card-refund-consent")).not.toBeChecked();
    await expect(dialog.locator("#card-refund-consent")).toHaveAttribute(
      "required",
      ""
    );
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBeTruthy();
    await dialog.locator("#card-payment-options").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/card-sandbox-${locale}-mobile.png`,
      fullPage: false,
    });
  });

test("the actual order form submits Mastercard consent and opens the local checkout", async ({
  page,
}) => {
  await page.goto("/?lang=ru#tarot");
  await page.locator("[data-product=tarot]").first().click();
  await page.locator("#customer-name").fill("Sandbox Form Client");
  await page
    .locator("#customer-email")
    .fill("form-" + crypto.randomUUID() + "@sandbox.invalid");
  await page.locator("#privacy-consent").check();
  await page.locator("input[name=payment-method][value=card]").check();
  await page.locator("#card-brand").selectOption("mastercard");
  await page.locator("#card-refund-consent").check();
  await page.locator("#order-form button[type=submit]").click();
  await expect(page).toHaveURL(/\/sandbox\/card\//);
  await expect(
    page.getByText("Расклад Таро на три карты · MASTERCARD")
  ).toBeVisible();
  await expect(page.getByText("Ожидает оплаты", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/card-sandbox-checkout-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/card-sandbox-checkout-mobile.png",
    fullPage: true,
  });
});

for (const method of ["apple_pay", "google_pay"])
  test(`${method}: preserves selection through the documented RiskPay adapter without a real charge`, async ({
    page,
    request,
  }) => {
    await page.goto("/?lang=ru#tarot");
    await page.locator("[data-product=tarot]").first().click();
    await page.locator("#customer-name").fill("Sandbox Wallet Client");
    await page
      .locator("#customer-email")
      .fill("wallet-" + crypto.randomUUID() + "@sandbox.invalid");
    await page.locator("#privacy-consent").check();
    await page.locator(`input[name=payment-method][value=${method}]`).check();
    await expect(page.locator("#card-brand")).toBeHidden();
    await page.locator("#card-refund-consent").check();
    await page.locator("#order-form button[type=submit]").click();
    await expect(page).toHaveURL(/\/sandbox\/card\//);
    const state = await (
      await request.get("/api/card-sandbox/" + page.url().split("/").at(-1))
    ).json();
    expect(state.brand).toBe(method);
    expect(state.provider).toMatchObject({
      id: "riskpay",
      mode: "fixture",
      hostedMethodsConditional: true,
    });
    expect(state.gatewayUrl).toBeUndefined();
    expect(state.report).toBeNull();
    await expect(
      page.getByText("RiskPay · тестовая интеграция", { exact: true })
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBeTruthy();
    await page.screenshot({
      path: `artifacts/riskpay-${method}-mobile.png`,
      fullPage: true,
    });
  });
