import { afterEach, expect, it, vi } from "vitest";
vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({})),
  updateBookingPayment: vi.fn(),
}));
vi.mock("../client-status", () => ({ createClientStatusLink: vi.fn() }));
vi.mock("../report-studio-db", () => ({
  enqueueReportJobForBooking: vi.fn(),
  processReportJob: vi.fn(),
}));
import { createSandboxCardCheckout } from "./card-sandbox-checkout";
import { CARD_TERMS_VERSION } from "../../reading-core/payments/copy.mjs";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("even both live flags cannot create a real payment before settlement quoting exists", async () => {
  for (const [key, value] of Object.entries({
    DEPLOYMENT_MODE: "sandbox",
    CARD_SANDBOX_ONLY: "true",
    AUTH_PROVIDER: "sandbox",
    PUBLIC_BASE_URL: "http://127.0.0.1:3000",
    DATABASE_URL: "mysql://fake:fake@127.0.0.1:3308/vedic_card_sandbox",
    RISKPAY_MODE: "live",
    RISKPAY_LIVE_ENABLED: "true",
  }))
    vi.stubEnv(key, value);
  const outgoing = vi.fn(() => {
    throw Error("Network must never be used");
  });
  vi.stubGlobal("fetch", outgoing);
  await expect(
    createSandboxCardCheckout({
      bookingId: 7,
      grossCents: 499,
      email: "fixture@sandbox.invalid",
      currency: "USD",
      locale: "en",
      brand: "visa",
      consent: true,
      termsVersion: CARD_TERMS_VERSION,
    })
  ).rejects.toThrow("authoritative settlement quoting");
  expect(outgoing).not.toHaveBeenCalled();
});
