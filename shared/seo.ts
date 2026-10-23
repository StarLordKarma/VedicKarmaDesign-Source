import { GUIDE_PATHS, readingGuide } from "./reading-guides";
export const SITE_ORIGIN = "https://karmalifedesign.com";
export const SEO_LOCALES = ["en", "ru", "de", "es"] as const;
export type SeoLocale = typeof SEO_LOCALES[number];
export const PUBLIC_PAGE_PATHS = ["/", "/privacy", "/refunds", ...GUIDE_PATHS] as const;
export type PublicPagePath = typeof PUBLIC_PAGE_PATHS[number];
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/social/report-preview.jpg`;
export function seoLocale(value: string | null | undefined): SeoLocale {
  return SEO_LOCALES.includes(value as SeoLocale) ? value as SeoLocale : "en";
}
export function isPublicPage(path: string): path is PublicPagePath {
  return PUBLIC_PAGE_PATHS.includes(path as PublicPagePath);
}
/** Never include request Host, order tokens or marketing parameters in public URLs. */
export function publicPageUrl(path: PublicPagePath, locale: SeoLocale) {
  return `${SITE_ORIGIN}${path}${locale === "en" ? "" : `?lang=${locale}`}`;
}
export const seoCopy = {
  en: {
    title: "Personal Vedic Astrology PDF Reading | Vedic Karma Design",
    description: "Explore a sample Vedic astrology PDF before ordering your personal birth-chart reading. Compare packages, pay with USDT and receive a private report.",
    privacy: "Privacy and personal data", refunds: "Payments and refunds",
    privacyDescription: "How Vedic Karma Design handles birth details, email, payment information, private reports and optional analytics.",
    refundsDescription: "Payment and refund conditions for Vedic Karma Design reports, including transfer fees, supported networks and payment errors.",
    heading: "Your personal Vedic astrology reading",
    intro: "A birth-chart calculation and automated interpretation based on your birth date, time and place, presented in a private PDF. Astrology is an interpretive practice for reflection, not a guarantee of future events.",
    sample: "Explore a fictional sample report", sampleNote: "Three selected pages from a demonstration report using fictional birth details. Your report is based on your own information.",
    pages: ["Report cover", "Vedic birth chart", "Planetary periods"],
    packages: "Compare packages and order", packageText: "Choose a basic or extended reading. Check the current price, supported USDT network, exact amount and payment expiry before paying. Network fees are shown by your wallet.",
    delivery: "After blockchain confirmation, report preparation starts. Your PDF is available through a protected order link, with an email notification.",
    openPdf: "Open the sample PDF", javascript: "Enable JavaScript to complete the questionnaire and pay.",
  },
  ru: {
    title: "Персональный ведический разбор в PDF | Vedic Karma Design",
    description: "Посмотрите пример ведического разбора в PDF до заказа. Персональная карта по данным рождения, сравнение пакетов, оплата USDT и приватный отчёт.",
    privacy: "Конфиденциальность и личные данные", refunds: "Оплата и возвраты",
    privacyDescription: "Как Vedic Karma Design обрабатывает данные рождения, email, сведения об оплате, приватные отчёты и необязательную аналитику.",
    refundsDescription: "Условия оплаты и возврата за отчёты Vedic Karma Design: комиссии перевода, поддерживаемые сети и ошибки при оплате.",
    heading: "Ваш персональный ведический разбор",
    intro: "Расчёт карты и автоматизированная интерпретация по дате, времени и месту рождения в приватном PDF. Астрология — интерпретационная практика для размышления, а не гарантия будущих событий.",
    sample: "Посмотрите вымышленный пример отчёта", sampleNote: "Три избранные страницы демонстрационного отчёта с вымышленными данными рождения. Ваш отчёт формируется по вашим данным.",
    pages: ["Обложка отчёта", "Ведическая карта рождения", "Планетарные периоды"],
    packages: "Сравнить пакеты и заказать", packageText: "Выберите базовый или расширенный разбор. До оплаты проверьте актуальную цену, поддерживаемую сеть USDT, точную сумму и срок перевода. Кошелёк показывает сетевую комиссию.",
    delivery: "После подтверждения в блокчейне запускается подготовка отчёта. PDF доступен по защищённой ссылке заказа, уведомление отправляется на email.",
    openPdf: "Открыть пример PDF", javascript: "Включите JavaScript, чтобы заполнить анкету и оплатить заказ.",
  },
  de: {
    title: "Persönliche vedische Deutung als PDF | Vedic Karma Design",
    description: "Sehen Sie einen vedischen PDF-Musterbericht vor der Bestellung. Persönliche Deutung Ihrer Geburtsdaten, Paketauswahl, USDT-Zahlung und privater Bericht.",
    privacy: "Datenschutz und persönliche Daten", refunds: "Zahlung und Rückerstattung",
    privacyDescription: "Wie Vedic Karma Design Geburtsdaten, E-Mail, Zahlungsinformationen, private Berichte und optionale Analysen verarbeitet.",
    refundsDescription: "Zahlungs- und Erstattungsbedingungen für Vedic Karma Design: Überweisungsgebühren, unterstützte Netzwerke und Zahlungsfehler.",
    heading: "Ihre persönliche vedische Deutung",
    intro: "Eine Horoskopberechnung mit automatisierter Interpretation anhand von Geburtsdatum, Uhrzeit und Ort als privates PDF. Astrologie dient der Reflexion und garantiert keine zukünftigen Ereignisse.",
    sample: "Einen fiktiven Musterbericht ansehen", sampleNote: "Drei ausgewählte Seiten eines Musterberichts mit fiktiven Geburtsdaten. Ihr Bericht basiert auf Ihren eigenen Angaben.",
    pages: ["Titelseite", "Vedisches Geburtshoroskop", "Planetenperioden"],
    packages: "Pakete vergleichen und bestellen", packageText: "Wählen Sie die grundlegende oder erweiterte Deutung. Prüfen Sie den aktuellen Preis, das unterstützte USDT-Netzwerk, den genauen Betrag und die Frist. Ihre Wallet zeigt die Netzwerkgebühr.",
    delivery: "Nach der Blockchain-Bestätigung beginnt die Berichterstellung. Das PDF ist über einen geschützten Bestelllink verfügbar; Sie erhalten eine E-Mail-Benachrichtigung.",
    openPdf: "PDF-Muster öffnen", javascript: "Aktivieren Sie JavaScript, um das Formular auszufüllen und zu bezahlen.",
  },
  es: {
    title: "Lectura védica personal en PDF | Vedic Karma Design",
    description: "Mira un informe védico de ejemplo antes de pedir tu lectura personal. Carta según tus datos de nacimiento, paquetes, pago con USDT e informe privado.",
    privacy: "Privacidad y datos personales", refunds: "Pagos y reembolsos",
    privacyDescription: "Cómo Vedic Karma Design trata los datos de nacimiento, email, información de pago, informes privados y analítica opcional.",
    refundsDescription: "Condiciones de pago y reembolso de Vedic Karma Design: comisiones de transferencia, redes admitidas y errores de pago.",
    heading: "Tu lectura védica personal",
    intro: "Cálculo de la carta e interpretación automatizada según la fecha, hora y lugar de nacimiento, en un PDF privado. La astrología es una práctica interpretativa para reflexionar, no una garantía de acontecimientos futuros.",
    sample: "Explora un informe ficticio de ejemplo", sampleNote: "Tres páginas seleccionadas de un informe de demostración con datos de nacimiento ficticios. Tu informe se basa en tus propios datos.",
    pages: ["Portada del informe", "Carta natal védica", "Periodos planetarios"],
    packages: "Comparar paquetes y pedir", packageText: "Elige una lectura básica o ampliada. Comprueba el precio actual, la red USDT admitida, el importe exacto y el plazo. Tu monedero muestra la comisión de red.",
    delivery: "Tras la confirmación en la cadena de bloques, comienza la preparación. El PDF está disponible mediante un enlace protegido del pedido, con aviso por email.",
    openPdf: "Abrir el PDF de ejemplo", javascript: "Activa JavaScript para completar el formulario y pagar.",
  },
} as const;
export function pageMetadata(path: string, locale: SeoLocale) {
  const t = seoCopy[locale];
  const guide = readingGuide(path, locale);
  if (guide) return { title: `${guide.title} | Karma Life Design`, description: guide.description };
  if (path === "/privacy") return { title: `${t.privacy} | Vedic Karma Design`, description: t.privacyDescription };
  if (path === "/refunds") return { title: `${t.refunds} | Vedic Karma Design`, description: t.refundsDescription };
  if (path === "/") return { title: t.title, description: t.description };
  return { title: "Vedic Karma Design", description: "" };
}
export function publicStructuredData(locale: SeoLocale) {
  const canonical = publicPageUrl("/", locale);
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization`, name: "Vedic Karma Design", url: `${SITE_ORIGIN}/` },
    { "@type": "Service", "@id": `${canonical}#reading`, name: seoCopy[locale].heading, description: seoCopy[locale].intro, url: canonical, serviceType: "Personal Vedic astrology PDF reading", provider: { "@id": `${SITE_ORIGIN}/#organization` } },
  ] };
}
