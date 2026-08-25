import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServicePricing: vi.fn(async (currency = "USD") => ({ basicUsd: currency === "USD" ? 41 : 23, numerologyAddonUsd: currency === "USD" ? 16 : 9 })),
  createBookingRequest: vi.fn(async (input: Record<string, unknown>) => ({ id: 77, ...input, createdAt: new Date() })),
  updateBookingPayment: vi.fn(async () => undefined),
  deleteBookingRequest: vi.fn(async () => undefined),
  createSmokeTestRun: vi.fn(async (runId: string) => ({ id: 1, runId })),
  finishSmokeTestRun: vi.fn(async () => undefined),
  createCheckoutForBooking: vi.fn(async (input: { totalUsd: number; addon: boolean; priceCurrency?: string }) => ({ id: "invoice-77", invoice_url: "https://checkout.test/invoice-77", totalUsd: input.totalUsd, addon: input.addon, priceCurrency: input.priceCurrency })),
  notifyOwner: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getServicePricing: mocks.getServicePricing, createBookingRequest: mocks.createBookingRequest, updateBookingPayment: mocks.updateBookingPayment, deleteBookingRequest: mocks.deleteBookingRequest, createSmokeTestRun: mocks.createSmokeTestRun, finishSmokeTestRun: mocks.finishSmokeTestRun };
});
vi.mock("./payment-flow", () => ({ createCheckoutForBooking: mocks.createCheckoutForBooking }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { appRouter } from "./routers";

describe("booking pricing integration", () => {
  beforeEach(() => { mocks.getServicePricing.mockClear(); mocks.createBookingRequest.mockClear(); mocks.createSmokeTestRun.mockClear(); mocks.finishSmokeTestRun.mockClear(); mocks.createCheckoutForBooking.mockReset(); mocks.createCheckoutForBooking.mockImplementation(async (input: { totalUsd: number; addon: boolean; priceCurrency?: string }) => ({ id: "invoice-77", invoice_url: "https://checkout.test/invoice-77", totalUsd: input.totalUsd, addon: input.addon, priceCurrency: input.priceCurrency })); mocks.deleteBookingRequest.mockClear(); });

  it("uses persisted non-default pricing for booking storage and checkout", async () => {
    const caller = appRouter.createCaller({
      req: { protocol: "https", get: (header: string) => header === "host" ? "example.test" : undefined } as never,
      res: {} as never,
      user: null,
    });

    const result = await caller.booking.submit({
      name: "Maya",
      email: "maya@example.com",
      birthDate: "1990-04-12",
      birthTime: "08:30",
      birthCity: "Berlin",
      birthCountry: "Germany",
      language: "English",
      addon: true,
      interest: "Career themes",
    });

    expect(mocks.createBookingRequest).toHaveBeenCalledWith(expect.objectContaining({ addon: 1, packageCode: "basic_plus", packageVersion: 1, priceSnapshotJson: JSON.stringify({ packageCode: "basic_plus", packageVersion: 1, currency: "USD", basicAmount: 41, addonAmount: 16, totalAmount: 57 }), totalUsd: 57 }));
    expect(mocks.getServicePricing).toHaveBeenCalledWith("USD");
    expect(mocks.createCheckoutForBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 77, totalUsd: 57, addon: true, priceCurrency: "USD", origin: "https://example.test" }));
    expect(result).toEqual(expect.objectContaining({ id: 77, totalUsd: 57, paymentId: "invoice-77", invoiceUrl: "https://checkout.test/invoice-77" }));
    expect(mocks.deleteBookingRequest).not.toHaveBeenCalled();
  });

  it("cleans up a marked smoke-test booking after successful checkout creation", async () => {
    const caller = appRouter.createCaller({ req: { protocol: "https", get: () => "example.test" } as never, res: {} as never, user: null });
    const result = await caller.booking.submit({ name: "Smoke Test", email: "production-smoke-1724320000100@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: false, interest: "Automated production checkout verification", smokeTest: true, smokeTestRunId: "production-smoke-1724320000100" });
    expect(result.smokeTestCleanup).toBe("completed");
    expect(mocks.deleteBookingRequest).toHaveBeenCalledWith(77);
  });

  it("cleans up a marked smoke-test booking when checkout creation fails", async () => {
    mocks.createCheckoutForBooking.mockRejectedValueOnce(new Error("provider unavailable"));
    const caller = appRouter.createCaller({ req: { protocol: "https", get: () => "example.test" } as never, res: {} as never, user: null });
    await expect(caller.booking.submit({ name: "Smoke Test", email: "production-smoke-1724320000101@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: false, interest: "Automated production checkout verification", smokeTest: true, smokeTestRunId: "production-smoke-1724320000101" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.deleteBookingRequest).toHaveBeenCalledWith(77);
  });

  it("rejects unsupported booking currency before creating an invoice", async () => {
    const caller = appRouter.createCaller({ req: { protocol: "https", get: () => "example.test" } as never, res: {} as never, user: null });
    await expect(caller.booking.submit({ name: "Maya", email: "maya@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: false, interest: "", currency: "JPY" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createBookingRequest).not.toHaveBeenCalled();
    expect(mocks.createCheckoutForBooking).not.toHaveBeenCalled();
  });
});
