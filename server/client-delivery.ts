import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[character] ?? character); }
function getDeliveryCopy(language: string) {
  if (language === "Русский") return { subject: "Ваше ведическое астрологическое чтение", greeting: "Здравствуйте", body: "Ваше персональное чтение ведической астрологии прикреплено в виде PDF.", receiptBody: "Запрошенная квитанция с детализацией стоимости прикреплена в виде PDF.", disclaimer: "Дисклеймер: материал предназначен только для личного осмысления и духовного исследования; это не медицинская, юридическая, финансовая, психологическая или иная профессиональная консультация. Прогнозы и конкретные результаты не гарантируются. Обязательные права потребителя и ответственность, которую нельзя исключить по закону, сохраняются.", signoff: "С заботой" };
  if (language === "Deutsch") return { subject: "Ihre vedische astrologische Deutung", greeting: "Guten Tag", body: "Ihre persönliche vedische astrologische Deutung ist als PDF angehängt.", receiptBody: "Die angeforderte Quittung mit der Preisaufschlüsselung ist als PDF angehängt.", disclaimer: "Hinweis: Dieser Inhalt dient ausschließlich der persönlichen Reflexion und spirituellen Orientierung. Er ist keine medizinische, rechtliche, finanzielle, psychologische oder sonstige Fachberatung. Vorhersagen und bestimmte Ergebnisse werden nicht garantiert. Zwingende Verbraucherrechte und gesetzlich nicht ausschließbare Haftung bleiben unberührt.", signoff: "Mit besten Grüßen" };
  if (language === "Español") return { subject: "Tu lectura de astrología védica", greeting: "Hola", body: "Tu lectura personalizada de astrología védica está adjunta en formato PDF.", receiptBody: "El recibo solicitado con el desglose del precio está adjunto en formato PDF.", disclaimer: "Aviso: este material se ofrece únicamente para la reflexión personal y la exploración espiritual. No constituye asesoramiento médico, legal, financiero, psicológico ni profesional. No se garantizan predicciones ni resultados concretos. Se mantienen los derechos imperativos del consumidor y la responsabilidad que legalmente no pueda excluirse.", signoff: "Con atención" };
  return { subject: "Your Vedic astrology reading", greeting: "Hello", body: "Your personalized Vedic astrology reading is attached as a PDF.", receiptBody: "Your requested price breakdown receipt is attached as a PDF.", disclaimer: "Disclaimer: This material is provided for personal reflection and spiritual exploration only. It is not medical, legal, financial, psychological, or other professional advice. Predictions and specific outcomes are not guaranteed. Mandatory consumer rights and liability that cannot legally be excluded remain unaffected.", signoff: "With care" };
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
    body: JSON.stringify({ from: ENV.resendFromEmail, to: [input.email], subject: copy.subject, html: `<p>${copy.greeting} ${safeName},</p><p>${copy.body}</p><p style="font-size:12px;color:#635a52">${copy.disclaimer}</p><p>${copy.signoff},<br />Jyotish</p>`, attachments: [{ filename: input.pdfName || "natal-chart.pdf", content: bytesToBase64(pdfBytes) }] }),
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
    body: JSON.stringify({ from: ENV.resendFromEmail, to: [input.email], subject: `Receipt · ${copy.subject}`, html: `<p>${copy.greeting},</p><p>${copy.receiptBody}</p><p style="font-size:12px;color:#635a52">${copy.disclaimer}</p><p>${copy.signoff},<br />Jyotish</p>`, attachments: [{ filename: input.pdfName || "receipt.pdf", content: bytesToBase64(pdfBytes) }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Email provider rejected the receipt delivery${detail ? `: ${detail.slice(0, 240)}` : "."}` });
  }
  return (await response.json()) as { id?: string };
}
