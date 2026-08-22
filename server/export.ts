import PDFDocument from "pdfkit";
import type { BookingRequest, ServicePricingHistory } from "../drizzle/schema";
import type { AdminActivityEvents } from "./db";
import { formatCurrency, type SupportedCurrency } from "../shared/currency";

export type ReportPreviewLocale = "ru" | "en" | "de";

const reportPreviewCopy: Record<ReportPreviewLocale, { eyebrow: string; title: string; subtitle: string; packageLabel: string; settings: string; settingsValue: string; sampleHeading: string; sampleBody: string; disclaimer: string }> = {
  ru: {
    eyebrow: "ВЕДИЧЕСКАЯ АСТРОЛОГИЯ · JYOTISH",
    title: "Ваша карта внутреннего неба",
    subtitle: "Предварительный образ будущего подробного отчёта",
    packageLabel: "Базовый отчёт · D1 / Рāśi",
    settings: "Методика",
    settingsValue: "Сидерический зодиак · Лахири · Vimshottari dasha",
    sampleHeading: "Основные акценты карты",
    sampleBody: "Этот демонстрационный разворот показывает светлую editorial-верстку отчёта. Фактические положения планет и интерпретационный текст будут добавлены после детерминированного расчёта и проверки владельцем.",
    disclaimer: "Демонстрационный макет. Астрологическая интерпретация носит информационный и рефлексивный характер, не является медицинской, психологической, юридической или финансовой консультацией и не гарантирует результат.",
  },
  en: {
    eyebrow: "VEDIC ASTROLOGY · JYOTISH",
    title: "A clearer map of your inner sky",
    subtitle: "Preview of the future detailed report",
    packageLabel: "Basic report · D1 / Rāśi",
    settings: "Method",
    settingsValue: "Sidereal zodiac · Lahiri · Vimshottari dasha",
    sampleHeading: "Core chart themes",
    sampleBody: "This demonstration spread presents the light editorial direction of the report. Actual planetary positions and interpretive text will be added after deterministic calculation and owner review.",
    disclaimer: "Demonstration layout. Astrological interpretation is informational and reflective, is not medical, psychological, legal or financial advice, and does not guarantee any outcome.",
  },
  de: {
    eyebrow: "VEDISCHE ASTROLOGIE · JYOTISH",
    title: "Eine klarere Karte Ihres inneren Himmels",
    subtitle: "Vorschau auf den späteren ausführlichen Bericht",
    packageLabel: "Basisbericht · D1 / Rāśi",
    settings: "Methode",
    settingsValue: "Siderischer Tierkreis · Lahiri · Vimshottari-Dasha",
    sampleHeading: "Zentrale Themen der Karte",
    sampleBody: "Diese Demonstrationsseite zeigt die helle redaktionelle Gestaltung des Berichts. Tatsächliche Planetenpositionen und interpretative Texte werden nach der deterministischen Berechnung und der Prüfung durch die Inhaberin ergänzt.",
    disclaimer: "Demonstrationslayout. Die astrologische Interpretation dient der Information und Reflexion, ist keine medizinische, psychologische, rechtliche oder finanzielle Beratung und garantiert kein Ergebnis.",
  },
};

export async function buildReportStylePreviewPdf(input: { background: Buffer; locale?: ReportPreviewLocale; clientName?: string; packageType?: "basic" | "basic_plus"; fontPath?: string; narrativeSummary?: string }) {
  const locale = input.locale ?? "ru";
  const copy = reportPreviewCopy[locale];
  const packageLabel = input.packageType === "basic_plus" ? copy.packageLabel.replace(/Basic|Базовый|Basisbericht/gi, (match) => ({ Basic: "Basic+ report", "Базовый": "Расширенный отчёт", Basisbericht: "Plusbericht" }[match] ?? match)) : copy.packageLabel;
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: copy.title, Subject: "Report Studio visual prototype" } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const fontName = input.fontPath ? "ReportSans" : "Helvetica";
  if (input.fontPath) doc.registerFont(fontName, input.fontPath);
  doc.image(input.background, 0, 0, { width: pageWidth, height: pageHeight });
  doc.fillOpacity(0.9).fillColor("#FBF6EC").roundedRect(42, 54, 390, 730, 18).fill();
  doc.fillOpacity(1).fillColor("#A96346").fontSize(9).font(fontName).text(copy.eyebrow, 72, 94, { characterSpacing: 1.2 });
  doc.fillColor("#302A25").font(fontName).fontSize(31).text(copy.title, 72, 145, { width: 300, lineGap: 4 });
  doc.fillColor("#73685D").font(fontName).fontSize(12).text(copy.subtitle, 72, 270, { width: 290, lineGap: 4 });
  doc.fillColor("#B47552").roundedRect(72, 336, 260, 28, 14).fill();
  doc.fillColor("#FFF9F0").font(fontName).fontSize(9).text(packageLabel, 86, 346, { width: 232, align: "center" });
  doc.fillColor("#302A25").font(fontName).fontSize(11).text(input.clientName ?? (locale === "ru" ? "Имя клиента" : locale === "de" ? "Name der Kundin / des Kunden" : "Client name"), 72, 404);
  doc.fillColor("#73685D").font(fontName).fontSize(10).text(`${copy.settings}: ${copy.settingsValue}`, 72, 432, { width: 300, lineGap: 3 });
  doc.moveTo(72, 490).lineTo(370, 490).lineWidth(0.7).strokeColor("#D8C8B4").stroke();
  doc.fillColor("#302A25").font(fontName).fontSize(17).text(copy.sampleHeading, 72, 525, { width: 300 });
  doc.fillColor("#514A43").font(fontName).fontSize(10.5).text(input.narrativeSummary ?? copy.sampleBody, 72, 566, { width: 300, lineGap: 5 });
  doc.fillColor("#85776A").font(fontName).fontSize(7.5).text(copy.disclaimer, 72, 730, { width: 300, lineGap: 3 });
  doc.fillColor("#A96346").font(fontName).fontSize(8).text("REPORT STUDIO · PREVIEW", 72, 812, { characterSpacing: 0.8 });
  doc.end();
  return result;
}

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


type ChartPanelPlacement = { planet: string; sign: number; degreeInSign: number };

function drawVedicChartPanel(doc: PDFKit.PDFDocument, placements: ChartPanelPlacement[], x: number, y: number, size: number, title: string, fontName: string) {
  const cell = size / 4;
  doc.fillColor("#fffaf0").roundedRect(x, y, size, size, 12).fill();
  doc.strokeColor("#b47552").lineWidth(1).roundedRect(x, y, size, size, 12).stroke();
  doc.fillColor("#302a25").font(fontName).fontSize(12).text(title, x, y - 24, { width: size, align: "center" });
  doc.strokeColor("#8d7868").lineWidth(0.8);
  const lines = [[0, 0, size, size], [size, 0, 0, size], [cell * 2, 0, cell * 2, size], [0, cell * 2, size, cell * 2], [cell, 0, cell * 2, cell], [size, cell, cell * 2, cell * 2], [cell * 3, 0, cell * 2, cell], [0, cell, cell, cell * 2], [0, cell * 3, cell, cell * 2], [cell * 3, size, cell * 2, cell * 2], [size, cell * 3, cell * 2, cell * 2], [cell, size, cell * 2, cell * 3]];
  for (const [x1, y1, x2, y2] of lines) doc.moveTo(x + x1, y + y1).lineTo(x + x2, y + y2).stroke();
  const grouped = new Map<number, ChartPanelPlacement[]>();
  for (const placement of placements) grouped.set(placement.sign, [...(grouped.get(placement.sign) ?? []), placement]);
  for (let house = 0; house < 12; house += 1) {
    const cx = x + (house % 4 + 0.5) * cell;
    const cy = y + (Math.floor(house / 4) + 0.5) * cell;
    const items = grouped.get(house) ?? [];
    doc.fillColor("#a96346").font(fontName).fontSize(7).text(String(house + 1), cx - 10, cy - 18, { width: 20, align: "center" });
    doc.fillColor("#302a25").font(fontName).fontSize(8).text(items.map((p) => `${p.planet === "Ascendant" ? "Asc" : p.planet.slice(0, 3)} ${p.degreeInSign.toFixed(1)}°`).join("\n") || "—", cx - cell / 2 + 5, cy - 5, { width: cell - 10, align: "center", lineGap: 1 });
  }
}

export async function buildFullNatalReportPdf(input: { background: Buffer; locale: ReportPreviewLocale; clientName: string; packageType: "basic" | "basic_plus"; narrative: { sections: Array<{ sectionKey: string; title: string; paragraphs: string[]; factRefs: string[] }> }; facts: any; fontPath?: string }) {
  const copy = reportPreviewCopy[input.locale];
  const pageCount = input.packageType === "basic_plus" ? 25 : 22;
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: copy.title, Subject: "Personal Vedic astrology report" } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk) => chunks.push(Buffer.from(chunk))); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const width = doc.page.width;
  const height = doc.page.height;
  const fontName = input.fontPath ? "ReportSans" : "Helvetica";
  if (input.fontPath) doc.registerFont(fontName, input.fontPath);
  const factsText = JSON.stringify(input.facts).slice(0, 1800);
  const sectionLabels = input.locale === "ru" ? ["Обзор карты", "Асцендент и дома", "Планетные акценты", "Накшатры", "Vimshottari dasha", "Практика рефлексии"] : input.locale === "de" ? ["Kartenübersicht", "Aszendent und Häuser", "Planetenbetonungen", "Nakshatras", "Vimshottari-Dasha", "Reflexionspraxis"] : ["Chart overview", "Ascendant and houses", "Planetary emphasis", "Nakshatras", "Vimshottari dasha", "Reflective practice"];
  const disclaimer = copy.disclaimer;
  for (let page = 1; page <= pageCount; page += 1) {
    if (page > 1) doc.addPage();
    doc.image(input.background, 0, 0, { width, height });
    doc.fillOpacity(0.92).fillColor("#FBF6EC").roundedRect(42, 42, width - 84, height - 84, 18).fill();
    doc.fillOpacity(1).fillColor("#A96346").font(fontName).fontSize(8).text(`${copy.eyebrow}  ·  ${String(page).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`, 72, 72, { characterSpacing: 1 });
    doc.fillColor("#302A25").font(fontName).fontSize(page === 1 ? 30 : 20).text(page === 1 ? copy.title : sectionLabels[(page - 2) % sectionLabels.length], 72, page === 1 ? 130 : 128, { width: width - 144, lineGap: 5 });
    doc.fillColor("#73685D").font(fontName).fontSize(10).text(`${input.clientName}  ·  ${copy.settingsValue}`, 72, page === 1 ? 260 : 186, { width: width - 144 });
    if (page === 1) {
      doc.fillColor("#514A43").font(fontName).fontSize(12).text(input.packageType === "basic_plus" ? "D1 / Rāśi · D9 / Navāṁśa · Vimshottari" : "D1 / Rāśi · Vimshottari", 72, 320, { width: width - 144 });
      doc.fillColor("#514A43").font(fontName).fontSize(11).text(input.narrative.sections[0]?.paragraphs[0] ?? copy.sampleBody, 72, 390, { width: 360, lineGap: 6 });
    } else if (page === 2 || (page === 3 && input.packageType === "basic_plus")) {
      const placements = page === 2 ? input.facts.d1 : input.facts.d9;
      drawVedicChartPanel(doc, placements, 72, 250, width - 144, page === 2 ? "D1 · Rāśi chart" : "D9 · Navāṁśa chart", fontName);
      doc.fillColor("#8D7868").font(fontName).fontSize(8).text("Sidereal zodiac · Lahiri · whole-sign houses · degrees rounded for display", 72, 700, { width: width - 144, align: "center" });
    } else {
      const section = input.narrative.sections[(page - 2) % Math.max(1, input.narrative.sections.length)];
      doc.fillColor("#514A43").font(fontName).fontSize(12).text(section?.paragraphs.join("\n\n") ?? copy.sampleBody, 72, 240, { width: width - 144, lineGap: 6 });
      doc.fillColor("#8D7868").font(fontName).fontSize(8).text(`Validated fact references: ${section?.factRefs.join(", ") ?? "chart contract"}`, 72, 600, { width: width - 144 });
      if (page === pageCount - 1) {
        doc.fillColor("#8D7868").font(fontName).fontSize(8).text(`Calculation facts snapshot:\n${factsText}`, 72, 640, { width: width - 144, lineGap: 3 });
      }
    }
    doc.fillColor("#85776A").font(fontName).fontSize(7.5).text(disclaimer, 72, height - 92, { width: width - 144, lineGap: 3 });
    doc.fillColor("#A96346").font(fontName).fontSize(8).text("REPORT STUDIO · PARASARA LIGHT 9", 72, height - 58, { characterSpacing: 0.8 });
  }
  doc.end();
  return result;
}
