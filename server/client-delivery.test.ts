import { describe, expect, it, vi } from "vitest";
import { sendClientNatalPdf } from "./client-delivery";

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

  it("rejects a provider failure", async () => {
    signedUrl.mockResolvedValue("https://storage.example/private.pdf");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("%PDF-1.7", { status: 200 })).mockResolvedValueOnce(new Response("provider error", { status: 500 }));
    await expect(sendClientNatalPdf({ email: "client@example.com", name: "Maya", pdfKey: "natal-charts/1/chart.pdf", pdfName: "chart.pdf", language: "English" })).rejects.toThrow("Email provider rejected");
    fetchMock.mockRestore();
  });
});
