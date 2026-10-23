import {readReportAttachment,assertReportAttachment} from './report-attachment';
import {knowledgeStore} from './knowledge/store';
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { storageGetSignedUrl } from "./storage";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const resendEndpoint = () => process.env.RESEND_BASE_URL || RESEND_ENDPOINT;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>\"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&#39;",
      })[character] ?? character
  );
}
function getDeliveryCopy(language: string) {
  if (language === "Русский")
    return {
      subject: "Ваше ведическое астрологическое чтение",
      greeting: "Здравствуйте",
      body: "Ваше персональное чтение ведической астрологии прикреплено в виде PDF.",
      receiptBody:
        "Запрошенная квитанция с детализацией стоимости прикреплена в виде PDF.",
      disclaimer:
        "Дисклеймер: материал предназначен только для личного осмысления и духовного исследования; это не медицинская, юридическая, финансовая, психологическая или иная профессиональная консультация. Прогнозы и конкретные результаты не гарантируются. Обязательные права потребителя и ответственность, которую нельзя исключить по закону, сохраняются.",
      signoff: "С заботой",
    };
  if (language === "Deutsch")
    return {
      subject: "Ihre vedische astrologische Deutung",
      greeting: "Guten Tag",
      body: "Ihre persönliche vedische astrologische Deutung ist als PDF angehängt.",
      receiptBody:
        "Die angeforderte Quittung mit der Preisaufschlüsselung ist als PDF angehängt.",
      disclaimer:
        "Hinweis: Dieser Inhalt dient ausschließlich der persönlichen Reflexion und spirituellen Orientierung. Er ist keine medizinische, rechtliche, finanzielle, psychologische oder sonstige Fachberatung. Vorhersagen und bestimmte Ergebnisse werden nicht garantiert. Zwingende Verbraucherrechte und gesetzlich nicht ausschließbare Haftung bleiben unberührt.",
      signoff: "Mit besten Grüßen",
    };
  if (language === "Español")
    return {
      subject: "Tu lectura de astrología védica",
      greeting: "Hola",
      body: "Tu lectura personalizada de astrología védica está adjunta en formato PDF.",
      receiptBody:
        "El recibo solicitado con el desglose del precio está adjunto en formato PDF.",
      disclaimer:
        "Aviso: este material se ofrece únicamente para la reflexión personal y la exploración espiritual. No constituye asesoramiento médico, legal, financiero, psicológico ni profesional. No se garantizan predicciones ni resultados concretos. Se mantienen los derechos imperativos del consumidor y la responsabilidad que legalmente no pueda excluirse.",
      signoff: "Con atención",
    };
  return {
    subject: "Your Vedic astrology reading",
    greeting: "Hello",
    body: "Your personalized Vedic astrology reading is attached as a PDF.",
    receiptBody: "Your requested price breakdown receipt is attached as a PDF.",
    disclaimer:
      "Disclaimer: This material is provided for personal reflection and spiritual exploration only. It is not medical, legal, financial, psychological, or other professional advice. Predictions and specific outcomes are not guaranteed. Mandatory consumer rights and liability that cannot legally be excluded remain unaffected.",
    signoff: "With care",
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    for (let offset = 0; offset < chunk.length; offset += 1)
      binary += String.fromCharCode(chunk[offset]);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

export async function sendClientNatalPdf(input: {
  email: string;
  name: string;
  pdfKey: string;
  pdfName: string;
  language: string;
}) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email delivery is not configured.",
    });
  const signedUrl = await storageGetSignedUrl(input.pdfKey);
  const pdfResponse = await fetch(signedUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!pdfResponse.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not retrieve the attached PDF from storage.",
    });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdfBytes.length > 12 * 1024 * 1024)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The attached PDF exceeds the delivery limit.",
    });
  const copy = getDeliveryCopy(input.language);
  const safeName = escapeHtml(input.name);
  const response = await fetch(resendEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.email],
      subject: copy.subject,
      html: `<p>${copy.greeting} ${safeName},</p><p>${copy.body}</p><p style="font-size:12px;color:#635a52">${copy.disclaimer}</p><p>${copy.signoff},<br />Jyotish</p>`,
      attachments: [
        {
          filename: input.pdfName || "natal-chart.pdf",
          content: bytesToBase64(pdfBytes),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Email provider rejected the delivery${detail ? `: ${detail.slice(0, 240)}` : "."}`,
    });
  }
  return (await response.json()) as { id?: string };
}

export async function sendClientReceiptPdf(input: {
  email: string;
  pdfKey: string;
  pdfName: string;
  language: string;
}) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email delivery is not configured.",
    });
  const signedUrl = await storageGetSignedUrl(input.pdfKey);
  const pdfResponse = await fetch(signedUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!pdfResponse.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not retrieve the receipt PDF from storage.",
    });
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  if (pdfBytes.length > 12 * 1024 * 1024)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The receipt PDF exceeds the delivery limit.",
    });
  const copy = getDeliveryCopy(input.language);
  const response = await fetch(resendEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.email],
      subject: `Receipt · ${copy.subject}`,
      html: `<p>${copy.greeting},</p><p>${copy.receiptBody}</p><p style="font-size:12px;color:#635a52">${copy.disclaimer}</p><p>${copy.signoff},<br />Jyotish</p>`,
      attachments: [
        {
          filename: input.pdfName || "receipt.pdf",
          content: bytesToBase64(pdfBytes),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Email provider rejected the receipt delivery${detail ? `: ${detail.slice(0, 240)}` : "."}`,
    });
  }
  return (await response.json()) as { id?: string };
}

export async function sendClientReportPdf(input: {
  email: string;
  name: string;
  pdfKey: string;
  pdfName: string;
  language: string;
  idempotencyKey?: string;
  statusUrl?: string;
  product?: string;
  expectedPdfSha256?: string | null;
  outboxKey?: string;
}) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email delivery is not configured.",
    });
  if(input.outboxKey&&(!input.idempotencyKey||!input.expectedPdfSha256))throw new TRPCError({code:"PRECONDITION_FAILED",message:"Delivery snapshot requires a verified PDF and idempotency key."});
  const outbox=input.outboxKey?knowledgeStore():undefined;
  const saved=outbox?await outbox.get(input.outboxKey!):null;
  let mail:any;
  if(saved){
    if(saved.schemaVersion!=="report-mail/v1"||typeof saved.payload?.attachments?.[0]?.content!=="string"||saved.payload.attachments[0].content.length>16*1024*1024||saved.idempotencyKey!==input.idempotencyKey||saved.payload?.to?.length!==1||saved.payload.to[0]!==input.email||saved.payload.attachments?.length!==1)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Delivery snapshot integrity check failed.'});
    assertReportAttachment(Buffer.from(saved.payload.attachments[0].content,'base64'),input.expectedPdfSha256);
    mail=saved.payload;
  }else{
  const signedUrl = await storageGetSignedUrl(input.pdfKey);
  const pdfResponse = await fetch(signedUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!pdfResponse.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Could not retrieve the approved report PDF from storage.",
    });
  const pdfBytes = await readReportAttachment(pdfResponse,input.expectedPdfSha256);
  const copy = getDeliveryCopy(input.language);
  if(input.product){const locale=input.language==='Русский'?'ru':input.language==='Deutsch'?'de':input.language==='Español'?'es':'en';const area=input.product.startsWith('vedic_')?0:input.product==='tarot'?2:1;const names={en:['Vedic astrology','Western astrology','Tarot'],ru:['Ведическая астрология','Западная астрология','Таро'],es:['Astrología védica','Astrología occidental','Tarot'],de:['Vedische Astrologie','Westliche Astrologie','Tarot']};copy.subject=names[locale][area]+' · '+({en:'Your personal report',ru:'Ваш личный отчёт',es:'Tu informe personal',de:'Ihr persönlicher Bericht'})[locale];copy.body=({en:'Thank you for your order. Your personal illustrated report is attached as a PDF. We hope you enjoy reading it. You can save it and, if you wish, share it with family, friends or your partner.',ru:'Спасибо за ваш заказ. К письму приложен ваш персональный красочный отчёт в формате PDF. Желаем приятного чтения! Сохраните его и при желании поделитесь с семьёй, друзьями или партнёром.',es:'Gracias por tu pedido. Adjuntamos tu informe personal ilustrado en PDF. Esperamos que disfrutes de la lectura. Puedes guardarlo y, si lo deseas, compartirlo con tu familia, tus amistades o tu pareja.',de:'Vielen Dank für Ihre Bestellung. Im Anhang finden Sie Ihren persönlichen illustrierten PDF-Bericht. Wir wünschen Ihnen eine angenehme Lektüre. Sie können ihn speichern und auf Wunsch mit Ihrer Familie, Freunden oder Ihrem Partner teilen.'})[locale]}

  const locale = input.language === 'Русский' ? 'ru' : input.language === 'Deutsch' ? 'de' : input.language === 'Español' ? 'es' : 'en';
  const statusLabel = {en:'Order status and PDF',ru:'Статус заказа и PDF',es:'Estado del pedido y PDF',de:'Bestellstatus und PDF'}[locale];
  const safeName = escapeHtml(input.name.trim());
  const safeStatusUrl = input.statusUrl && /^https:\/\//.test(input.statusUrl) ? escapeHtml(input.statusUrl) : undefined;
    mail={
      from: ENV.resendFromEmail,
      to: [input.email],
      subject: copy.subject,
      text: `${copy.greeting}, ${input.name.trim()}!\n\n${copy.body}\n\n${input.statusUrl ? statusLabel+": "+input.statusUrl+"\n\n" : ""}${copy.signoff},\nKarma Life Design`,
      html: `<html lang="${locale}"><body><p>${copy.greeting}, ${safeName}!</p><p>${copy.body}</p>${safeStatusUrl ? `<p><a href="${safeStatusUrl}">${statusLabel}</a></p>` : ""}<p style="font-size:12px;color:#635a52">${copy.disclaimer}</p><p>${copy.signoff},<br />Karma Life Design</p></body></html>`,
      attachments: [
        {
          filename: input.pdfName || "vedic-report.pdf",
          content: bytesToBase64(pdfBytes),
        },
      ],
    };
    if(outbox)await outbox.put(input.outboxKey!,{schemaVersion:'report-mail/v1',idempotencyKey:input.idempotencyKey,payload:mail});
  }
  const response = await fetch(resendEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let concurrent=false;try{concurrent=JSON.parse(detail).name==="concurrent_idempotent_requests"}catch{}
    throw new TRPCError({
      code: response.status >= 400 && response.status < 500 && response.status !== 429 && !concurrent ? "BAD_REQUEST" : "BAD_GATEWAY",
      message: `Email provider rejected the report delivery${detail ? `: ${detail.slice(0, 240)}` : "."}`,
    });
  }
  const accepted=await response.json();
  if(typeof accepted?.id!=="string"||!accepted.id||accepted.id.length>160)throw new TRPCError({code:"BAD_GATEWAY",message:"Email provider returned an ambiguous acknowledgement."});
  return accepted as {id:string};
}

export async function sendSlaChartPdf(input: {
  email: string;
  pdfBytes: Uint8Array;
  pdfName: string;
  rangeLabel: string;
  language: string;
}) {
  if (!ENV.resendApiKey || !ENV.resendFromEmail)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email delivery is not configured.",
    });
  if (input.pdfBytes.length === 0 || input.pdfBytes.length > 12 * 1024 * 1024)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The SLA chart PDF exceeds the delivery limit.",
    });
  const language =
    input.language === "ru"
      ? "ru"
      : input.language === "de"
        ? "de"
        : input.language === "es"
          ? "es"
          : "en";
  const copy =
    language === "ru"
      ? {
          subject: "Отчёт по нарушениям SLA",
          greeting: "Здравствуйте",
          body: "Отчёт с графиками нарушений SLA прикреплён в формате PDF.",
          period: "Выбранный период",
        }
      : language === "de"
        ? {
            subject: "SLA-Verstoßbericht",
            greeting: "Guten Tag",
            body: "Der Bericht mit den SLA-Verstoßgrafiken ist als PDF angehängt.",
            period: "Ausgewählter Zeitraum",
          }
        : language === "es"
          ? {
              subject: "Informe de incumplimientos SLA",
              greeting: "Hola",
              body: "El informe con los gráficos de incumplimientos SLA está adjunto en formato PDF.",
              period: "Periodo seleccionado",
            }
          : {
              subject: "SLA violations report",
              greeting: "Hello",
              body: "The SLA violations chart report is attached as a PDF.",
              period: "Selected period",
            };
  const safeRange = escapeHtml(input.rangeLabel);
  const response = await fetch(resendEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [input.email],
      subject: copy.subject,
      html: `<p>${copy.greeting},</p><p>${copy.body}</p><p>${copy.period}: <strong>${safeRange}</strong></p><p style="font-size:12px;color:#635a52">This operational report is provided for internal monitoring and does not constitute professional advice.</p>`,
      attachments: [
        {
          filename: input.pdfName || "sla-violations-report.pdf",
          content: bytesToBase64(input.pdfBytes),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Email provider rejected the SLA report delivery${detail ? `: ${detail.slice(0, 240)}` : "."}`,
    });
  }
  return (await response.json()) as { id?: string };
}
