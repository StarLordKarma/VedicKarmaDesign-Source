import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServicePricing: vi.fn(async () => ({ basicUsd: 41, numerologyAddonUsd: 16 })),
  createBookingRequest: vi.fn(async (input: Record<string, unknown>) => ({ id: 77, ...input, createdAt: new Date() })),
  updateBookingPayment: vi.fn(async () => undefined),
  createCheckoutForBooking: vi.fn(async (input: { totalUsd: number; addon: boolean }) => ({ id: "invoice-77", invoice_url: "https://checkout.test/invoice-77", totalUsd: input.totalUsd, addon: input.addon })),
  notifyOwner: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getServicePricing: mocks.getServicePricing, createBookingRequest: mocks.createBookingRequest, updateBookingPayment: mocks.updateBookingPayment };
});
vi.mock("./payment-flow", () => ({ createCheckoutForBooking: mocks.createCheckoutForBooking }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { appRouter } from "./routers";

describe("booking pricing integration", () => {
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

    expect(mocks.createBookingRequest).toHaveBeenCalledWith(expect.objectContaining({ addon: 1, totalUsd: 57 }));
    expect(mocks.createCheckoutForBooking).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 77, totalUsd: 57, addon: true, origin: "https://example.test" }));
    expect(result).toEqual(expect.objectContaining({ id: 77, totalUsd: 57, paymentId: "invoice-77", invoiceUrl: "https://checkout.test/invoice-77" }));
  });
});
