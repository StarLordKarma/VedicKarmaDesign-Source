import { describe, expect, it } from "vitest";
import { buildActivityCsv, buildBookingsCsv, buildPricingHistoryCsv, decodePdfBase64, sanitizePdfName } from "./export";
import { attachNatalPdfSchema } from "@shared/admin";
import type { BookingRequest } from "../drizzle/schema";

const row = {
  id: 7,
  name: "Maya Test",
  email: "maya@example.com",
  birthDate: "1990-04-12",
  birthTime: "08:30",
  birthCity: "Berlin",
  birthCountry: "Germany",
  language: "English",
  addon: 1,
  totalUsd: 35,
  interest: null,
  paymentId: null,
  paymentUrl: null,
  paymentStatus: "finished",
  status: "completed",
  adminNote: "Ready to deliver",
  statusUpdatedAt: null,
  statusUpdatedBy: null,
  natalPdfKey: "natal-charts/7/chart.pdf",
  natalPdfUrl: "/manus-storage/natal-charts/7/chart.pdf",
  natalPdfName: "chart.pdf",
  natalPdfUploadedAt: null,
  natalPdfUploadedBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
} as BookingRequest;

describe("admin exports and PDF validation", () => {
  it("creates a UTF-8 CSV with booking and attachment metadata", () => {
    const csv = buildBookingsCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("maya@example.com");
    expect(csv).toContain("chart.pdf");
    expect(csv).toContain("completed");
  });

  it("exports owner activity events as a quoted UTF-8 CSV", () => {
    const csv = buildActivityCsv({
      deliveryFailures: [{ id: 7, name: "Maya Test", email: "maya@example.com", deliveryError: 'Mailbox "rejected"', createdAt: new Date("2026-01-01T00:00:00Z") }],
      pendingPayments: [{ id: 8, name: "Leo Test", email: "leo@example.com", totalUsd: 35, paymentStatus: "waiting", createdAt: new Date("2026-01-02T00:00:00Z") }],
      recentlyEditedClients: [{ id: 11, bookingId: 7, name: "Maya Test", email: "maya@example.com", changedBy: "owner-123", changedAt: new Date("2026-01-03T00:00:00Z"), changes: '{"name":{"from":"Maya","to":"Maya Test"}}' }],
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("delivery_failure");
    expect(csv).toContain("pending_payment");
    expect(csv).toContain("client_edited");
    expect(csv).toContain('Mailbox ""rejected""');
    expect(csv).toContain("owner-123");
    expect(csv).toContain("2026-01-03T00:00:00.000Z");
  });

  it("exports pricing history with currency, before/after amounts, and display name", () => {
    const csv = buildPricingHistoryCsv([{ id: 3, currency: "EUR", oldBasicAmount: 23, oldNumerologyAddonAmount: 9, newBasicAmount: 25, newNumerologyAddonAmount: 10, changedBy: "owner-123", changedByName: "Anika Jyotish", changedAt: new Date("2026-08-22T12:00:00Z") }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Currency");
    expect(csv).toContain("EUR");
    expect(csv).toContain("23");
    expect(csv).toContain("25");
    expect(csv).toContain("Anika Jyotish");
    expect(csv).toContain("2026-08-22T12:00:00.000Z");
  });

  it("accepts a PDF signature and rejects non-PDF data", () => {
    const valid = Buffer.from("%PDF-1.7\ncontent").toString("base64");
    expect(decodePdfBase64(valid).subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(() => decodePdfBase64(Buffer.from("not a pdf").toString("base64"))).toThrow("valid PDF");
  });

  it("sanitizes uploaded filenames and validates PDF attachment payloads", () => {
    expect(sanitizePdfName("chart final (1).pdf")).toBe("chart_final__1_.pdf");
    expect(attachNatalPdfSchema.safeParse({ bookingId: 7, fileName: "chart.pdf", contentBase64: "JVBERi0x" }).success).toBe(true);
    expect(attachNatalPdfSchema.safeParse({ bookingId: 7, fileName: "chart.txt", contentBase64: "JVBERi0x" }).success).toBe(false);
  });
});
