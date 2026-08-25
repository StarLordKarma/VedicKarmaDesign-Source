import { describe, expect, it, vi } from "vitest";
import { sendClientNatalPdf, sendClientReceiptPdf, sendClientReportPdf, sendSlaChartPdf } from "./client-delivery";

const { signedUrl } = vi.hoisted(() => ({ signedUrl: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: signedUrl }));

describe("client natal PDF delivery", () => {
  it("retrieves the private PDF and sends it as a base64 attachment", async () => {
    signedUrl.mockResolvedValue("https://storage.example/private.pdf");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("%PDF-1.7", { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "email_123" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await sendClientNatalPdf({ email: "client@example.com", name: "Maya", pdfKey: "natal-charts/1/chart.pdf", pdfName: "chart.pdf", language: "English" });
    expect(result.id).toBe("email_123");
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.to).toEqual(["client@example.com"]);
    expect(body.attachments[0].filename).toBe("chart.pdf");
    expect(body.attachments[0].content).toBe(Buffer.from("%PDF-1.7").toString("base64"));
    fetchMock.mockRestore();
  });

  it("sends an approved Report Studio PDF with the report-specific filename", async () => {
    signedUrl.mockResolvedValue("https://storage.example/approved-report.pdf");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("%PDF-1.7", { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "report_email_1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await sendClientReportPdf({ email: "client@example.com", name: "Maya", pdfKey: "report-studio/1/v1.pdf", pdfName: "vedic-report-1.pdf", language: "English" });
    expect(result.id).toBe("report_email_1");
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.to).toEqual(["client@example.com"]);
    expect(body.attachments[0].filename).toBe("vedic-report-1.pdf");
    expect(body.html).toContain("Your personalized Vedic astrology reading");
    fetchMock.mockRestore();
  });

  it("localizes receipt body and disclaimer for every supported language", async () => {
    signedUrl.mockResolvedValue("https://storage.example/receipt.pdf");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (const [language, expected] of [["English", "Your requested price breakdown receipt"], ["Русский", "Запрошенная квитанция"], ["Deutsch", "angeforderte Quittung"], ["Español", "recibo solicitado"]] as const) {
      fetchMock.mockResolvedValueOnce(new Response("%PDF-1.7", { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: `email_${language}` }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await sendClientReceiptPdf({ email: "client@example.com", pdfKey: "price-breakdowns/receipt.pdf", pdfName: "receipt.pdf", language });
      const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(body.html).toContain(expected);
      expect(body.html).toMatch(/(Disclaimer|Дисклеймер|Hinweis|Aviso)/);
    }
    fetchMock.mockRestore();
  });

  it("sends a generated SLA chart PDF with a localized period label", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ id: "sla_email_1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await sendSlaChartPdf({ email: "owner@example.com", pdfBytes: new TextEncoder().encode("%PDF-1.7"), pdfName: "sla-week.pdf", rangeLabel: "2026-08-17 — 2026-08-23", language: "ru" });
    expect(result.id).toBe("sla_email_1");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.attachments[0].filename).toBe("sla-week.pdf");
    expect(body.attachments[0].content).toBe(Buffer.from("%PDF-1.7").toString("base64"));
    expect(body.html).toContain("2026-08-17 — 2026-08-23");
    fetchMock.mockRestore();
  });

  it("rejects a provider failure", async () => {
    signedUrl.mockResolvedValue("https://storage.example/private.pdf");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("%PDF-1.7", { status: 200 })).mockResolvedValueOnce(new Response("provider error", { status: 500 }));
    await expect(sendClientNatalPdf({ email: "client@example.com", name: "Maya", pdfKey: "natal-charts/1/chart.pdf", pdfName: "chart.pdf", language: "English" })).rejects.toThrow("Email provider rejected");
    fetchMock.mockRestore();
  });
});
