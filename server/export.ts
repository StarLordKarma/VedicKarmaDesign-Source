import PDFDocument from "pdfkit";
import type { BookingRequest, ServicePricingHistory } from "../drizzle/schema";
import type { AdminActivityEvents } from "./db";
import { formatCurrency, type SupportedCurrency } from "../shared/currency";

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildActivityCsv(events: AdminActivityEvents) {
  const headers = ["Event type", "Booking ID", "Client", "Email", "Status", "Amount USD", "Details", "Changed by", "Occurred at"];
  const rows = [
    ...events.deliveryFailures.map((event) => ["delivery_failure", event.id, event.name, event.email, "failed", "", event.deliveryError ?? "", "", event.createdAt.toISOString()]),
    ...events.pendingPayments.map((event) => ["pending_payment", event.id, event.name, event.email, event.paymentStatus ?? "waiting", event.totalUsd, "", "", event.createdAt.toISOString()]),
    ...events.recentlyEditedClients.map((event) => ["client_edited", event.bookingId, event.name, event.email, "edited", "", event.changes, event.changedBy, event.changedAt.toISOString()]),
  ];
  return `\uFEFF${headers.map(escapeCsv).join(",")}\n${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
}

export function buildPricingHistoryCsv(rows: Array<ServicePricingHistory & { changedByName?: string }>) {
  const headers = ["ID", "Currency", "Old basic amount", "Old add-on amount", "New basic amount", "New add-on amount", "Changed by", "Changed at"];
  const lines = rows.map((row) => [
    row.id,
    row.currency,
    row.oldBasicAmount,
    row.oldNumerologyAddonAmount,
    row.newBasicAmount,
    row.newNumerologyAddonAmount,
    row.changedByName ?? row.changedBy,
    row.changedAt.toISOString(),
  ].map(escapeCsv).join(","));
  return `\uFEFF${headers.map(escapeCsv).join(",")}\n${lines.join("\n")}`;
}

export function buildSmokeTestRunsCsv(rows: Array<{ runId: string; status: string; result: string | null; startedAt: Date; finishedAt: Date | null; durationMs: number | null }>) {
  const headers = ["Run ID", "Status", "Started at", "Finished at", "Duration ms", "Result JSON"];
  const lines = rows.map((row) => [row.runId, row.status, row.startedAt.toISOString(), row.finishedAt?.toISOString() ?? "", row.durationMs ?? "", row.result ?? ""].map(escapeCsv).join(","));
  return `\uFEFF${headers.map(escapeCsv).join(",")}\n${lines.join("\n")}`;
}

export function buildBookingsCsv(rows: BookingRequest[]) {
  const headers = ["ID", "Name", "Email", "Birth date", "Birth time", "Birth city", "Birth country", "Language", "Add-on", "Total USD", "Request status", "Payment status", "Admin note", "Natal PDF", "Created at"];
  const lines = rows.map((row) => [
    row.id,
    row.name,
    row.email,
    row.birthDate,
    row.birthTime,
    row.birthCity,
    row.birthCountry,
    row.language,
    row.addon ? "yes" : "no",
    row.totalUsd,
    row.status,
    row.paymentStatus ?? "waiting",
    row.adminNote ?? "",
    row.natalPdfName ?? "",
    row.createdAt.toISOString(),
  ].map(escapeCsv).join(","));
  return `\uFEFF${headers.map(escapeCsv).join(",")}\n${lines.join("\n")}`;
}

export async function buildCheckoutBreakdownPdf(input: { currency: SupportedCurrency; locale: string; basicUsd: number; numerologyAddonUsd: number; addon: boolean; labels: { title: string; currency: string; basic: string; addon: string; addonNotSelected: string; total: string; generated: string; disclaimer: string } }) {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: input.labels.title } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const addonAmount = input.addon ? input.numerologyAddonUsd : 0;
  const total = input.basicUsd + addonAmount;
  doc.fillColor("#28231f").fontSize(22).text(input.labels.title);
  doc.moveDown(0.4).fillColor("#635a52").fontSize(10).text(`${input.labels.currency}: ${input.currency}`);
  doc.moveDown(1.2).fillColor("#28231f").fontSize(12).text(input.labels.basic, { continued: true }).text(formatCurrency(input.basicUsd, input.currency, input.locale), { align: "right" });
  doc.moveDown(0.5).fillColor("#635a52").fontSize(12).text(input.addon ? input.labels.addon : `${input.labels.addon} · ${input.labels.addonNotSelected}`, { continued: true }).text(formatCurrency(addonAmount, input.currency, input.locale), { align: "right" });
  doc.moveDown(0.7).moveTo(48, doc.y).lineTo(547, doc.y).strokeColor("#d9d0c5").stroke();
  doc.moveDown(0.7).fillColor("#28231f").fontSize(15).text(input.labels.total, { continued: true }).text(formatCurrency(total, input.currency, input.locale), { align: "right" });
  doc.moveDown(2).fillColor("#635a52").fontSize(9).text(`${input.labels.generated}: ${new Date().toISOString()}`);
  doc.moveDown(1.5).fillColor("#635a52").fontSize(8).text(input.labels.disclaimer, { width: 500, align: "left" });
  doc.end();
  return result;
}

export async function buildBookingsPdf(rows: BookingRequest[]) {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: "Jyotish booking report" } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.fontSize(20).text("Jyotish booking report");
  doc.moveDown(0.4).fontSize(9).fillColor("#635a52").text(`Generated ${new Date().toISOString()} · ${rows.length} request(s)`);
  doc.moveDown(1).fillColor("#28231f");
  rows.forEach((row, index) => {
    if (index > 0) doc.moveDown(0.8).moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#d9d0c5").stroke().moveDown(0.8);
    doc.fontSize(13).text(`#${row.id} · ${row.name}`);
    doc.fontSize(9).fillColor("#635a52").text(`${row.email} · ${row.birthCity}, ${row.birthCountry} · ${row.birthDate} ${row.birthTime}`);
    doc.fillColor("#28231f").text(`Request: ${row.status} · Payment: ${row.paymentStatus ?? "waiting"} · Total: $${row.totalUsd}`);
    if (row.adminNote) doc.fillColor("#635a52").text(`Admin note: ${row.adminNote}`);
    if (row.natalPdfName) doc.fillColor("#635a52").text(`Natal PDF: ${row.natalPdfName}`);
  });
  doc.end();
  return result;
}

export function sanitizePdfName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "natal-chart.pdf";
}

export function decodePdfBase64(contentBase64: string) {
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.length === 0 || buffer.length > 12 * 1024 * 1024) throw new Error("PDF must be smaller than 12 MB.");
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("The uploaded file is not a valid PDF.");
  return buffer;
}
