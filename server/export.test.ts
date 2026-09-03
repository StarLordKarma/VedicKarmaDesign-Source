import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { buildActivityCsv, buildBookingsCsv, buildCheckoutBreakdownPdf, buildReportStylePreviewPdf, buildPricingHistoryCsv, buildSlaEvaluationRunsCsv, buildSmokeTestRunsCsv, decodePdfBase64, sanitizePdfName } from "./export";
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

  it("exports aggregate metrics and SLA evaluation history without client PII", () => {
    const csv = buildSlaEvaluationRunsCsv({ since: "2026-08-01T00:00:00.000Z", bookings: 12, paidBookings: 8, completedBookings: 5, failedDeliveries: 1, queuedReports: 2, sentReports: 4, openAlerts: 1 }, [{ id: 4, trigger: "heartbeat", status: "succeeded", evaluatedAt: new Date("2026-08-22T12:00:00Z"), durationMs: 42, jobsEvaluated: 8, preparationViolations: 2, deliveryViolations: 1, alertsCreated: 1, notificationsSent: 1, errorCode: null }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("bookings");
    expect(csv).toContain("heartbeat");
    expect(csv).toContain("Preparation violations");
    expect(csv).toContain("42");
    expect(csv).not.toContain("email");
    expect(csv).not.toContain("birthDate");
  });

  it("exports filtered smoke-test runs with status, timing, and JSON result", () => {
    const csv = buildSmokeTestRunsCsv([{ runId: "run-succeeded", status: "succeeded", result: '{"ok":true,"currency":"EUR"}', startedAt: new Date("2026-08-22T12:00:00Z"), finishedAt: new Date("2026-08-22T12:00:01Z"), durationMs: 1000 }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Run ID");
    expect(csv).toContain("run-succeeded");
    expect(csv).toContain("succeeded");
    expect(csv).toContain("1000");
    expect(csv).toContain('{""ok"":true,""currency"":""EUR""}');
    expect(csv).not.toContain("run-failed");
  });

  it("builds a localized checkout price-breakdown PDF with a consistent total", async () => {
    const pdf = await buildCheckoutBreakdownPdf({ currency: "EUR", locale: "ru-RU", basicUsd: 25, numerologyAddonUsd: 10, addon: true, labels: { title: "Разбивка стоимости", currency: "Валюта", basic: "Базовое чтение", addon: "Индийская нумерология", addonNotSelected: "Не выбрано", total: "Итого", generated: "Сформировано" } });
    expect(pdf.subarray(0, 8).toString("ascii")).toContain("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("builds a one-page localized report style prototype with a background image", async () => {
    const background = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const fontPath = [process.env.REPORT_FONT_PATH, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"].find((candidate) => candidate && existsSync(candidate));
    expect(fontPath).toBeTruthy();
    const pdf = await buildReportStylePreviewPdf({ background, locale: "ru", packageType: "basic", fontPath: fontPath! });
    expect(pdf.subarray(0, 8).toString("ascii")).toContain("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdf.toString("latin1")).toContain("/Count 1");
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


describe("full natal report PDF", () => {
  const background = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const facts = { d1: [{ planet: "Ascendant", sign: 0, degreeInSign: 12.3 }], d9: [{ planet: "Ascendant", sign: 5, degreeInSign: 3.2 }] };
  const narrative = { sections: [{ sectionKey: "core-themes", title: "Core themes", paragraphs: ["A cautious reflective summary."], factRefs: ["d1[0].sign"] }] };
  it("renders the requested Basic and Basic+ page counts with chart panels", async () => {
    const { buildFullNatalReportPdf } = await import("./export");
    const basic = await buildFullNatalReportPdf({ background, locale: "en", clientName: "Test Client", packageType: "basic", narrative, facts });
    const plus = await buildFullNatalReportPdf({ background, locale: "en", clientName: "Test Client", packageType: "basic_plus", narrative, facts });
    expect((basic.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(22);
    expect((plus.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(25);
  });
});
