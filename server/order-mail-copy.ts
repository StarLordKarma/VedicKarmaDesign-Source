import {
  DELIVERY_MINUTES,
  orderArea,
  type OrderLocale,
} from "../shared/order-lifecycle";
const names = {
  en: ["Tarot", "Western astrology", "Vedic astrology"],
  ru: ["Таро", "Западная астрология", "Ведическая астрология"],
  es: ["Tarot", "Astrología occidental", "Astrología védica"],
  de: ["Tarot", "Westliche Astrologie", "Vedische Astrologie"],
};
export function acceptanceCopy(
  locale: OrderLocale,
  id: number,
  product: string,
  statusUrl: string
) {
  const area = orderArea(product),
    [min, max] = DELIVERY_MINUTES[area],
    name = names[locale][area === "tarot" ? 0 : area === "western" ? 1 : 2];
  const c = {
    en: {
      subject: `Order #${id} accepted`,
      body: `Your order #${id} (${name}) has been accepted for preparation. We normally send the PDF in ${min}–${max} minutes after this message. Preparation or required review may take longer.`,
      link: "Order status",
    },
    ru: {
      subject: `Заказ №${id} принят в работу`,
      body: `Ваш заказ №${id} (${name}) принят в работу. Обычно мы отправляем PDF через ${min}–${max} минут после этого письма. Подготовка или обязательная проверка могут занять больше времени.`,
      link: "Статус заказа",
    },
    es: {
      subject: `Pedido #${id} aceptado`,
      body: `Tu pedido #${id} (${name}) se ha aceptado para su preparación. Normalmente enviamos el PDF entre ${min} y ${max} minutos después de este mensaje. La preparación o revisión necesaria puede tardar más.`,
      link: "Estado del pedido",
    },
    de: {
      subject: `Bestellung #${id} angenommen`,
      body: `Ihre Bestellung #${id} (${name}) wurde zur Bearbeitung angenommen. Normalerweise versenden wir das PDF ${min}–${max} Minuten nach dieser Nachricht. Vorbereitung oder erforderliche Prüfung können länger dauern.`,
      link: "Bestellstatus",
    },
  }[locale];
  if (!/^https?:\/\//.test(statusUrl)) throw Error("Invalid status URL");
  const esc = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  return {
    subject: c.subject,
    text: `${c.body}\n\n${c.link}: ${statusUrl}\n\nKarma Life Design`,
    html: `<html lang="${locale}"><body><p>${esc(c.body)}</p><p><a href="${esc(statusUrl)}">${c.link}</a></p><p>Karma Life Design</p></body></html>`,
  };
}
