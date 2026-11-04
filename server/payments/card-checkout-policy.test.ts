import { describe, expect, it } from "vitest";
import { manualCardRefundQuote } from "../../shared/card-refund";
import {
  cardSandboxEnabled,
  sandboxCardCallbackBase,
} from "./card-sandbox-config";
import { bookingSchema } from "../../shared/booking";
import { cardMethodMarkup } from "../../reading-core/payments/markup.mjs";
import {
  CARD_COPY,
  CARD_TERMS_VERSION,
} from "../../reading-core/payments/copy.mjs";
import { JSDOM } from "jsdom";
const env = {
  DEPLOYMENT_MODE: "sandbox",
  CARD_SANDBOX_ONLY: "true",
  AUTH_PROVIDER: "sandbox",
  PUBLIC_BASE_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "mysql://fake:fake@127.0.0.1:3308/vedic_card_sandbox",
};
const base = {
  name: "Sandbox test",
  email: "test@sandbox.invalid",
  language: "English",
  product: "tarot",
  addon: false,
  currency: "USD",
  privacyAcknowledged: true,
  privacyNoticeVersion: "privacy-2026-10-21",
  privacyLocale: "en",
};
it("uses a public fixture callback only during its explicitly bounded lifetime", () => {
  const now = 1800000000000;
  const current = {
    ...env,
    RISKPAY_CALLBACK_BASE_URL: "https://receiver.example.test",
    RISKPAY_CALLBACK_EXPIRES_AT: new Date(now + 60000).toISOString(),
  };
  expect(sandboxCardCallbackBase(current, now)).toBe(
    "https://receiver.example.test"
  );
  expect(sandboxCardCallbackBase(current, now + 60000)).toBe(
    "http://127.0.0.1:3000"
  );
  expect(
    sandboxCardCallbackBase(
      { ...current, RISKPAY_CALLBACK_EXPIRES_AT: "" },
      now
    )
  ).toBe("http://127.0.0.1:3000");
  expect(
    sandboxCardCallbackBase(
      {
        ...current,
        RISKPAY_CALLBACK_EXPIRES_AT: new Date(now + 86400000).toISOString(),
      },
      now
    )
  ).toBe("http://127.0.0.1:3000");
  expect(
    sandboxCardCallbackBase(
      {
        ...current,
        RISKPAY_CALLBACK_BASE_URL: "https://host.test/?token=secret",
      },
      now
    )
  ).toBe("http://127.0.0.1:3000");
  expect(() =>
    sandboxCardCallbackBase({ ...current, DEPLOYMENT_MODE: "independent" }, now)
  ).toThrow();
});
describe("manual card refund and sandbox boundaries", () => {
  it("deducts 20% of gross, then the disclosed network fee, without double-charging gateway fees", () => {
    expect(
      manualCardRefundQuote({
        grossMicroUsdc: "50000000",
        networkMicroUsdc: "10000",
        basis: "voluntary",
      })
    ).toEqual({
      grossMicroUsdc: "50000000",
      siteMicroUsdc: "10000000",
      networkMicroUsdc: "10000",
      netMicroUsdc: "39990000",
      basis: "voluntary",
    });
  });
  it("does not deduct fees from mandatory refunds", () => {
    expect(
      manualCardRefundQuote({
        grossMicroUsdc: "50000000",
        networkMicroUsdc: "10000",
        basis: "mandatory",
      })
    ).toMatchObject({
      siteMicroUsdc: "0",
      networkMicroUsdc: "0",
      netMicroUsdc: "50000000",
    });
  });
  it.each(["-1", "0.01", "1e6", "001", "999999999999999999999"])(
    "rejects invalid units %s",
    v => {
      expect(() =>
        manualCardRefundQuote({
          grossMicroUsdc: v,
          networkMicroUsdc: "0",
          basis: "voluntary",
        })
      ).toThrow();
    }
  );
  it("rejects refunds consumed by deductions", () => {
    expect(() =>
      manualCardRefundQuote({
        grossMicroUsdc: "100000",
        networkMicroUsdc: "80000",
        basis: "voluntary",
      })
    ).toThrow();
  });
  it("is independent of NODE_ENV build mode, but rejects live deployments and remote databases", () => {
    expect(cardSandboxEnabled({ ...env, NODE_ENV: "production" })).toBe(true);
    for (const patch of [
      { DEPLOYMENT_MODE: "independent" },
      { CARD_SANDBOX_ONLY: "false" },
      { PUBLIC_BASE_URL: "https://karmalifedesign.com" },
      { DATABASE_URL: "mysql://fake:fake@production.example.com/live" },
      { DATABASE_URL: "mysql://fake:fake@127.0.0.1/production" },
      { AUTH_PROVIDER: "wallet" },
    ])
      expect(cardSandboxEnabled({ ...env, ...patch })).toBe(false);
  });
  it("preserves existing crypto input and requires current explicit card agreement", () => {
    expect(bookingSchema.safeParse(base).success).toBe(true);
    expect(
      bookingSchema.safeParse({ ...base, paymentMethod: "card" }).success
    ).toBe(false);
    expect(
      bookingSchema.safeParse({
        ...base,
        paymentMethod: "card",
        cardBrand: "visa",
        cardRefundConsent: true,
        cardTermsVersion: CARD_TERMS_VERSION,
      }).success
    ).toBe(true);
    expect(
      bookingSchema.safeParse({
        ...base,
        paymentMethod: "card",
        cardBrand: "visa",
        cardRefundConsent: true,
        cardTermsVersion: "old-terms",
      }).success
    ).toBe(false);
  });
  it.each(["en", "ru", "es", "de"] as const)(
    "renders distinct localized consent with crypto selected and no prechecked agreement: %s",
    locale => {
      const dom = new JSDOM(cardMethodMarkup(locale)),
        doc = dom.window.document;
      expect(
        doc
          .querySelector("input[name=payment-method]:checked")
          ?.getAttribute("value")
      ).toBe("crypto");
      expect(
        (doc.querySelector("#card-refund-consent") as HTMLInputElement).checked
      ).toBe(false);
      expect(doc.body.textContent).toContain(CARD_COPY[locale].consent);
      expect(
        (doc.querySelector("#card-payment-details") as HTMLElement).hidden
      ).toBe(true);
      dom.window.close();
    }
  );
});

it.each(["apple_pay", "google_pay"] as const)(
  "requires separate current agreement for %s without inventing a card brand",
  paymentMethod => {
    expect(
      bookingSchema.safeParse({
        ...base,
        paymentMethod,
        cardRefundConsent: true,
        cardTermsVersion: CARD_TERMS_VERSION,
      }).success
    ).toBe(true);
    expect(
      bookingSchema.safeParse({
        ...base,
        paymentMethod,
        cardRefundConsent: false,
        cardTermsVersion: CARD_TERMS_VERSION,
      }).success
    ).toBe(false);
    const doc = new JSDOM(cardMethodMarkup("ru")).window.document;
    expect(doc.querySelector(`input[value=${paymentMethod}]`)).not.toBeNull();
  }
);
