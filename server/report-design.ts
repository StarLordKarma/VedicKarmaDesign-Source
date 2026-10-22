import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReportContent, type ReportPage } from "./full-report-content";
import { SIGN_LABELS, PLANET_LABELS, NAKSHATRA_LABELS } from "../shared/vedic-labels";
import type { buildFullNatalReportPdf } from "./export";

type Input = Parameters<typeof buildFullNatalReportPdf>[0];
const palette = { cream: "#F2E9DB", paper: "#FFF9F0", ink: "#302A25", muted: "#73685D", terra: "#A96346", gold: "#C7B48B", line: "#DFCDB2", sand: "#F0E5D5" };
const copy = {
  ru: { title: "Ваша карта внутреннего неба", eyebrow: "ВЕДИЧЕСКАЯ АСТРОЛОГИЯ / JYOTISH", personal: "ПЕРСОНАЛЬНОЕ ВЕДИЧЕСКОЕ ЧТЕНИЕ", for: "ПОДГОТОВЛЕНО ДЛЯ", asc: "Асцендент", moon: "Лунный знак", star: "Накшатра", sun: "Солнце", method: "Сидерический зодиак · Лахири · Дома целых знаков", chart: "Карта и её главные акценты", guide: "Как читать вашу карту", guideText: "Дом обозначает область опыта, а знак - её символический стиль. Читайте положения вместе со всей картой, а не как жёсткие ярлыки личности.", question: "ВОПРОС ДЛЯ РАЗМЫШЛЕНИЯ", questionText: "Как эта тема проявляется в моих решениях и повседневных привычках?", periods: "Ваша линия времени", asOf: "ТЕКУЩИЙ БОЛЬШОЙ ПЕРИОД НА", overview: "Обзор последовательности", active: "Текущий", past: "Завершён", future: "Следующий", periodNote: "Периоды - часть астрологической традиции, а не обещание событий или точный календарь будущего.", practice: "Из понимания - в небольшие действия", actions: [["Выберите одну опору", "Назовите небольшую выполнимую привычку, которая помогает сохранять ритм."], ["Наблюдайте семь дней", "Отмечайте действия и обстоятельства, которые действительно влияют на результат."], ["Пересмотрите подход", "Сохраните полезное. Решения опирайте на факты вашей жизни, а не только на карту."]], disclaimer: "Астрологическая интерпретация для размышления. Не является научным прогнозом, медицинской, психологической, юридической или финансовой консультацией.", summary: "КЛЮЧЕВЫЕ ПОЛОЖЕНИЯ", reading: "Персональная интерпретация", sample: "ВЫМЫШЛЕННЫЙ ПРИМЕР" },
  en: { title: "Your inner sky", eyebrow: "VEDIC ASTROLOGY / JYOTISH", personal: "YOUR PERSONAL VEDIC READING", for: "PREPARED FOR", asc: "Ascendant", moon: "Moon sign", star: "Nakshatra", sun: "Sun", method: "Sidereal zodiac · Lahiri · Whole-sign houses", chart: "Your chart at a glance", guide: "How to read your chart", guideText: "A house describes an area of experience; a sign, its symbolic style. Read placements in the context of the complete chart, rather than as fixed personality labels.", question: "A QUESTION FOR REFLECTION", questionText: "How does this theme appear in my choices and everyday habits?", periods: "Your timeline", asOf: "CURRENT MAJOR PERIOD AS OF", overview: "The sequence of periods", active: "Current", past: "Completed", future: "Upcoming", periodNote: "Periods belong to an astrological tradition; they are not a promise of events or a precise calendar of the future.", practice: "From insight to small actions", actions: [["Choose one anchor", "Name a small, achievable habit that helps you maintain a steady rhythm."], ["Observe for seven days", "Record actions and circumstances that actually influence the outcome."], ["Review your approach", "Keep what helps. Base decisions on the facts of your life, not only on a chart."]], disclaimer: "Astrological interpretation for reflection. Not a scientific forecast or medical, psychological, legal or financial advice.", summary: "KEY PLACEMENTS", reading: "Your personal interpretation", sample: "FICTIONAL SAMPLE" },
  de: { title: "Ihre innere Himmelskarte", eyebrow: "VEDISCHE ASTROLOGIE / JYOTISH", personal: "IHRE PERSÖNLICHE VEDISCHE DEUTUNG", for: "ERSTELLT FÜR", asc: "Aszendent", moon: "Mondzeichen", star: "Nakshatra", sun: "Sonne", method: "Siderischer Tierkreis · Lahiri · Ganzzeichenhäuser", chart: "Ihre Karte auf einen Blick", guide: "So lesen Sie Ihre Karte", guideText: "Ein Haus beschreibt einen Erfahrungsbereich, ein Zeichen dessen symbolischen Stil. Lesen Sie Positionen im Zusammenhang der ganzen Karte, nicht als starre Persönlichkeitsmerkmale.", question: "EINE FRAGE ZUR REFLEXION", questionText: "Wie zeigt sich dieses Thema in meinen Entscheidungen und Alltagsgewohnheiten?", periods: "Ihre Zeitlinie", asOf: "AKTUELLE HAUPTPERIODE AM", overview: "Abfolge der Perioden", active: "Aktuell", past: "Beendet", future: "Zukünftig", periodNote: "Perioden gehören zur astrologischen Tradition; sie sind kein Versprechen von Ereignissen oder genauer Zukunftskalender.", practice: "Von Einsichten zu kleinen Schritten", actions: [["Einen Anker wählen", "Benennen Sie eine kleine, machbare Gewohnheit, die Ihnen Stabilität gibt."], ["Sieben Tage beobachten", "Notieren Sie Handlungen und Umstände, die das Ergebnis tatsächlich beeinflussen."], ["Den Ansatz prüfen", "Behalten Sie Hilfreiches. Stützen Sie Entscheidungen auf Ihr Leben, nicht nur auf die Karte."]], disclaimer: "Astrologische Interpretation zur Reflexion. Keine wissenschaftliche Prognose oder medizinische, psychologische, rechtliche oder finanzielle Beratung.", summary: "ZENTRALE POSITIONEN", reading: "Ihre persönliche Interpretation", sample: "FIKTIVES BEISPIEL" },
  es: { title: "Tu mapa del cielo interior", eyebrow: "ASTROLOGÍA VÉDICA / JYOTISH", personal: "TU LECTURA VÉDICA PERSONAL", for: "PREPARADO PARA", asc: "Ascendente", moon: "Signo lunar", star: "Nakshatra", sun: "Sol", method: "Zodíaco sideral · Lahiri · Casas de signo completo", chart: "Tu carta de un vistazo", guide: "Cómo leer tu carta", guideText: "Una casa describe un ámbito de experiencia; un signo, su estilo simbólico. Lee las posiciones junto con toda la carta, sin etiquetas rígidas de personalidad.", question: "UNA PREGUNTA PARA REFLEXIONAR", questionText: "¿Cómo aparece este tema en mis decisiones y hábitos cotidianos?", periods: "Tu línea del tiempo", asOf: "PERIODO PRINCIPAL ACTUAL AL", overview: "Secuencia de periodos", active: "Actual", past: "Finalizado", future: "Próximo", periodNote: "Los periodos pertenecen a una tradición astrológica; no prometen acontecimientos ni son un calendario exacto del futuro.", practice: "De la comprensión a la acción", actions: [["Elige un apoyo", "Nombra un hábito pequeño y realizable que te ayude a mantener el ritmo."], ["Observa siete días", "Anota acciones y circunstancias que influyen realmente en el resultado."], ["Revisa tu enfoque", "Conserva lo útil. Basa tus decisiones en los hechos de tu vida, no solo en la carta."]], disclaimer: "Interpretación astrológica para reflexionar. No es un pronóstico científico ni asesoramiento médico, psicológico, jurídico o financiero.", summary: "POSICIONES PRINCIPALES", reading: "Tu interpretación personal", sample: "EJEMPLO FICTICIO" },
} as const;

export async function renderPersonalReport(input: Input): Promise<Buffer> {
  const t = copy[input.locale], f = input.facts;
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: t.title, Subject: "Personal Vedic astrology report", Keywords: "vedic-editorial-v2" } });
  const chunks: Buffer[] = []; const result = new Promise<Buffer>((resolve, reject) => { doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const font = [input.fontPath, process.env.REPORT_FONT_PATH, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"].find(p => p && existsSync(p));
  if (!font) throw new Error("A Unicode REPORT_FONT_PATH is required for PDF reports");
  doc.registerFont("ReportSans", font); doc.font("ReportSans");
  const w = doc.page.width, h = doc.page.height, left = 44, cw = w - 88;
  const rect = (x: number, y: number, width: number, height: number, color: string, radius = 8) => { doc.fillColor(color).roundedRect(x, y, width, height, radius).fill(); };
  const text = (value: string, x: number, y: number, size = 10, color: string = palette.ink, width = cw, options: PDFKit.Mixins.TextOptions = {}) => { doc.font("ReportSans").fontSize(size).fillColor(color).text(value, x, y, { width, lineGap: 3, ...options }); };
  const measure = (value: string, width: number, size = 10.5) => doc.font("ReportSans").fontSize(size).heightOfString(value, { width, lineGap: 5, paragraphGap: 0 });
  const fit = (value: string, x: number, y: number, width: number, height: number, size: number, color: string = palette.ink, align: "left" | "center" = "left") => { while (size > 7 && measure(value, width, size) > height) size -= .5; text(value, x, y, size, color, width, { align }); };
  const sign = (n: number) => SIGN_LABELS[input.locale][n] ?? "—";
  const planet = (name: string) => PLANET_LABELS[input.locale][PLANET_LABELS.en.indexOf(name)] || name;
  const moon = f.planets?.find((p: any) => p.planet === "Moon"), sun = f.planets?.find((p: any) => p.planet === "Sun");
  const date = (value: string, short = false) => new Intl.DateTimeFormat(input.locale, { year: "numeric", month: short ? "2-digit" : "short", day: "2-digit", timeZone: "UTC" }).format(new Date(value));
  const orbit = (x: number, y: number, radius: number, opacity = .3) => {
    doc.save().strokeOpacity(opacity).strokeColor(palette.gold).lineWidth(.5);
    for (const scale of [1, .89, .6]) doc.circle(x, y, radius * scale).stroke();
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; doc.moveTo(x + Math.cos(a) * radius * .89, y + Math.sin(a) * radius * .89).lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius).stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, b = a + Math.PI * .75; doc.moveTo(x + Math.cos(a) * radius * .6, y + Math.sin(a) * radius * .6).lineTo(x + Math.cos(b) * radius * .6, y + Math.sin(b) * radius * .6).stroke(); }
    doc.restore();
  };
  const pages: ReportPage[] = [{ title: t.title, body: "" }];
  for (const page of buildReportContent(input)) {
    if (page.chart || page.kind === "periods") { pages.push(page); continue; }
    let part = "";
    for (const word of page.body.split(/(\s+)/)) {
      const candidate = part + word;
      if (part.trim() && measure(candidate, cw - 32) > 430) { pages.push({ ...page, body: part.trim() }); part = word.trimStart(); } else part = candidate;
    }
    pages.push({ ...page, body: part.trim() });
  }
  const artPath = [resolve("client/public/backgrounds/pdf-meru-cover-300dpi.jpg"), resolve("dist/public/backgrounds/pdf-meru-cover-300dpi.jpg")].find(existsSync);
  const artwork = (doc as any).openImage(artPath ? readFileSync(artPath) : input.background);
  const footer = (index: number) => {
    doc.strokeColor(palette.line).lineWidth(.5).moveTo(left, h - 61).lineTo(w - left, h - 61).stroke();
    text("VEDIC KARMA DESIGN", left, h - 48, 6.5, palette.terra, 160);
    text(input.sampleLabel || (process.env.GEOCODING_PROVIDER === "geonames" ? "GeoNames.org · CC BY 4.0" : "SWISS EPHEMERIS · LAHIRI"), 220, h - 48, 6, palette.muted, 235, { align: "center" });
    text(`${String(index + 1).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`, w - 85, h - 48, 6.5, palette.muted, 41, { align: "right" });
    fit(t.disclaimer, left, h - 29, cw, 18, 6, palette.muted);
  };
  const chart = (placements: any[], x: number, y: number, size: number) => {
    rect(x - 6, y - 6, size + 12, size + 12, palette.paper);
    doc.roundedRect(x - 6, y - 6, size + 12, size + 12, 9).strokeColor(palette.line).lineWidth(.6).stroke();
    doc.strokeColor(palette.gold).lineWidth(.8).rect(x, y, size, size).stroke();
    doc.moveTo(x, y).lineTo(x + size, y + size).stroke(); doc.moveTo(x + size, y).lineTo(x, y + size).stroke();
    doc.moveTo(x + size / 2, y).lineTo(x + size, y + size / 2).lineTo(x + size / 2, y + size).lineTo(x, y + size / 2).closePath().stroke();
    const centers = [[.5, .27], [.25, .09], [.09, .25], [.27, .5], [.09, .75], [.25, .91], [.5, .73], [.75, .91], [.91, .75], [.73, .5], [.91, .25], [.75, .09]];
    const asc = placements.find(p => p.planet === "Ascendant")?.sign ?? f.ascendant?.sign ?? 0;
    const abbr = input.locale === "ru" ? ["Су", "Лу", "Ме", "Ве", "Ма", "Юп", "Са", "Ра", "Ке"] : ["Su", "Mo", "Me", "Ve", "Ma", "Ju", "Sa", "Ra", "Ke"];
    centers.forEach(([a, b], i) => {
      const zodiac = (asc + i) % 12, xx = x + a * size, yy = y + b * size;
      text(String(zodiac + 1), xx - 15, yy - 14, 6.5, palette.muted, 30, { align: "center" });
      const names = placements.filter(p => p.planet !== "Ascendant" && p.sign === zodiac).map(p => abbr[PLANET_LABELS.en.indexOf(p.planet)] || p.planet).join(" ");
      const labelWidth = size * (a < .15 || a > .85 ? .16 : .26);
      fit(names || " ", xx - labelWidth / 2, yy, labelWidth, size * .16, 8, palette.terra, "center");
    });
  };
  for (let i = 0; i < pages.length; i++) {
    if (i) doc.addPage(); const page = pages[i]; const cover = i === 0;
    rect(0, 0, w, h, palette.cream, 0);
    if (cover) { doc.image(artwork, 0, 0, { width: w, height: h }); doc.save().fillOpacity(.95); rect(29, 29, w - 58, h - 48, palette.paper, 22); doc.restore(); }
    else { rect(24, 19, w - 48, h - 38, palette.paper, 22); orbit(w - 68, 71, 65, .22); }
    text(cover ? "VEDIC KARMA DESIGN" : t.eyebrow, left, 48, cover ? 9 : 7, palette.terra);
    if (cover) {
      text(t.personal, left, 77, 7.5, palette.muted);
      fit(input.locale === "ru" ? "Ваша карта\nвнутреннего неба" : t.title, left, 118, cw - 15, 122, 35); orbit(w - 87, 108, 42, .25);
      doc.save().roundedRect(left, 258, cw, 316, 14).clip().image(artwork, left, 201, { width: cw, height: 475 }).restore();
      rect(59, 499, 245, 61, palette.paper, 9); text(t.for, 73, 510, 6.5, palette.terra, 217); fit(input.clientName, 73, 525, 217, 30, 20);
      fit(`${f.input?.localDate || "—"}  ·  ${f.input?.localTime || "—"}${input.birthPlace ? `  ·  ${input.birthPlace}` : ""}`, left, 595, cw, 27, 10);
      text(input.sampleLabel || t.method, left, 617, 8, palette.muted);
      const chips = [[t.asc, sign(f.ascendant?.sign)], [t.moon, moon ? sign(moon.sign) : "—"], [t.star, moon ? `${NAKSHATRA_LABELS[moon.nakshatra]} · ${input.locale === "ru" ? "пада" : "pada"} ${moon.pada}` : "—"]];
      chips.forEach(([label, value], n) => { const x = left + n * 173; rect(x, 655, 161, 61, palette.sand); text(label.toUpperCase(), x + 13, 667, 6.8, palette.muted, 135); fit(value, x + 13, 688, 135, 22, 13); });
      text(input.packageType === "basic_plus" ? "D1 / D9 · VIMSHOTTARI · NUMEROLOGY" : "D1 · VIMSHOTTARI", left, 741, 7.2, palette.terra);
    } else {
      text(`${String(i).padStart(2, "0")} / ${page.chart ? page.title : page.kind === "periods" ? "VIMSHOTTARI" : t.reading}`, left, 89, 7.5, palette.terra);
      fit(page.chart === "d1" ? t.chart : page.kind === "periods" ? t.periods : page.title, left, 119, cw, 63, 25);
      text(t.method, left, 186, 8, palette.muted);
      if (page.chart) {
        const placements = f[page.chart] || [];
        const panelAsc = placements.find((p: any) => p.planet === "Ascendant"), panelMoon = placements.find((p: any) => p.planet === "Moon"), panelSun = placements.find((p: any) => p.planet === "Sun");
        rect(left, 218, cw, 65, palette.sand); text(t.summary, 60, 231, 6.7, palette.terra);
        fit(`${t.asc}: ${panelAsc ? sign(panelAsc.sign) : "—"}  ·  ${t.moon}: ${panelMoon ? sign(panelMoon.sign) : "—"}  ·  ${t.sun}: ${panelSun ? sign(panelSun.sign) : "—"}`, 60, 251, cw - 32, 25, 10.5);
        chart(placements, 50, 310, 250); text(page.title, 120, 575, 8, palette.terra, 120, { align: "center" });
        const chartAsc = placements.find((p: any) => p.planet === "Ascendant"), chartMoon = placements.find((p: any) => p.planet === "Moon"), chartSun = placements.find((p: any) => p.planet === "Sun");
        [[t.asc, chartAsc], [t.moon, chartMoon], [t.sun, chartSun]].forEach(([label, p]: any, n) => { const y = 327 + n * 78; text(label.toUpperCase(), 358, y, 7, palette.terra, 180); fit(p ? sign(p.sign) : "—", 358, y + 19, 170, 26, 18); text(p ? `${Number(p.degreeInSign).toFixed(2)}°` : "—", 358, y + 45, 8, palette.muted, 170); });
        text(t.guide, left, 611, 17); text(t.guideText, left, 641, 10, palette.ink, cw, { lineGap: 5 });
        rect(left, 710, cw, 47, palette.sand); text(t.question, 58, 720, 6.4, palette.terra); fit(t.questionText, 58, 735, cw - 28, 18, 8.5);
      } else if (page.kind === "periods") {
        const periods = f.vimshottari?.periods || [], now = Date.now();
        const active = periods.find((p: any) => Date.parse(p.startUtc) <= now && Date.parse(p.endUtc) > now);
        rect(left, 216, cw, 96, palette.sand, 12); orbit(492, 263, 33, .4);
        text(`${t.asOf} ${date(new Date().toISOString(), true)}`, 61, 230, 6.7, palette.terra, 380);
        text(active ? planet(active.lord) : "—", 61, 250, 24, palette.ink, 370);
        text(active ? `${date(active.startUtc)} - ${date(active.endUtc)}` : t.periodNote, 61, 288, 9, palette.muted, 380);
        text(t.overview, left, 330, 17);
        const rowHeight = Math.min(29, 264 / Math.max(periods.length, 1));
        periods.forEach((p: any, n: number) => { const y = 366 + n * rowHeight, current = p === active; if (current) rect(77, y - 5, cw - 33, rowHeight - 1, palette.sand, 5); doc.fillColor(current ? palette.terra : palette.gold).circle(60, y + 5, current ? 4 : 3).fill(); text(planet(p.lord), 90, y, 9, palette.ink, 125); text(`${date(p.startUtc, true)} - ${date(p.endUtc, true)}`, 220, y, 8, palette.muted, 211); text(current ? t.active : Date.parse(p.endUtc) <= now ? t.past : t.future, 445, y, 7.2, current ? palette.terra : palette.muted, 95); });
        fit(t.practice, left, 650, cw, 29, 17);
        t.actions.forEach(([title, body], n) => { const x = left + n * 173; rect(x, 688, 161, 70, palette.sand); text(`0${n + 1}`, x + 11, 697, 12, palette.terra, 25); fit(title, x + 38, 699, 112, 18, 8); fit(body, x + 11, 720, 139, 32, 7.5); });
      } else {
        const first = page.body.split(/\n\n/)[0], blockHeight = measure(first, cw - 32);
        if (blockHeight <= 190) rect(left, 226, cw, blockHeight + 29, palette.sand, 10);
        text(page.body, 60, 240, 10.5, palette.ink, cw - 32, { lineGap: 5, paragraphGap: 0 });
        rect(left, 710, cw, 47, palette.sand); text(t.question, 58, 720, 6.4, palette.terra); fit(t.questionText, 58, 735, cw - 28, 18, 8.5);
      }
    }
    footer(i);
  }
  doc.end(); return result;
}
