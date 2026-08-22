import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[character] ?? character); }
function getDeliveryCopy(language: string) {
  if (language === "Русский") return { subject: "Ваше ведическое астрологическое чтение", greeting: "Здравствуйте", body: "Ваше персональное чтение ведической астрологии прикреплено в виде PDF.", signoff: "С заботой" };
  if (language === "Deutsch") return { subject: "Ihre vedische astrologische Deutung", greeting: "Guten Tag", body: "Ihre persönliche vedische astrologische Deutung ist als PDF angehängt.", signoff: "Mit besten Grüßen" };
  if (language === "Español") return { subject: "Tu lectura de astrología védica", greeting: "Hola", body: "Tu lectura personalizada de astrología védica está adjunta en formato PDF.", signoff: "Con atención" };
  return { subject: "Your Vedic astrology reading", greeting: "Hello", body: "Your personalized Vedic astrology reading is attached as a PDF.", signoff: "With care" };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let offset = 0; offset < chunk.length; offset += 1) binary += String.fromCharCode(chunk[offset]);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

export async function sendClientNatalPdf(input: { email: string; name: string; pdfKey: string; pdfName: string; language: string }) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email delivery is not configured." });
  const signedUrl = await storageGetSignedUrl(input.pdfKey);
  const pdfResponse = await fetch(signedUrl, { signal: AbortSignal.timeout(20_000) });
  if (!pdfResponse.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not retrieve the attached PDF from storage." });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdfBytes.length > 12 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The attached PDF exceeds the delivery limit." });
  const copy = getDeliveryCopy(input.language);
  const safeName = escapeHtml(input.name);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ from: ENV.resendFromEmail, to: [input.email], subject: copy.subject, html: `<p>${copy.greeting} ${safeName},</p><p>${copy.body}</p><p>${copy.signoff},<br />Jyotish</p>`, attachments: [{ filename: input.pdfName || "natal-chart.pdf", content: bytesToBase64(pdfBytes) }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Email provider rejected the delivery${detail ? `: ${detail.slice(0, 240)}` : "."}` });
  }
  return (await response.json()) as { id?: string };
}

export async function sendClientReceiptPdf(input: { email: string; pdfKey: string; pdfName: string; language: string }) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email delivery is not configured." });
  const signedUrl = await storageGetSignedUrl(input.pdfKey);
  const pdfResponse = await fetch(signedUrl, { signal: AbortSignal.timeout(20_000) });
  if (!pdfResponse.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not retrieve the receipt PDF from storage." });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdfBytes.length > 12 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "The receipt PDF exceeds the delivery limit." });
  const copy = getDeliveryCopy(input.language);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ from: ENV.resendFromEmail, to: [input.email], subject: `Receipt · ${copy.subject}`, html: `<p>${copy.greeting},</p><p>Your requested price breakdown receipt is attached as a PDF.</p><p>${copy.signoff},<br />Jyotish</p>`, attachments: [{ filename: input.pdfName || "receipt.pdf", content: bytesToBase64(pdfBytes) }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Email provider rejected the receipt delivery${detail ? `: ${detail.slice(0, 240)}` : "."}` });
  }
  return (await response.json()) as { id?: string };
}
