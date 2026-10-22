import React, { useEffect } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import type { Locale } from "@shared/i18n";

const copy = {
  en: { eyebrow: "INSIDE YOUR READING", title: "A few pages. A clearer picture.", body: "See the actual PDF layout: a celestial cover, your birth chart, and a clear timeline of periods. These three selected pages use Elena Marin, a fictional person with invented birth details.", badge: "FICTIONAL SAMPLE · ENGLISH", pages: ["An illustrated beginning", "Your chart, made visible", "Your timeline"], descriptions: ["Celestial artwork and a personal cover.", "A calculated D1 chart with planetary placements.", "Calculated periods with clear dates and small reflection steps."], open: "Open page", download: "Download the 3-page sample", note: "Selected pages from a sample report, not a complete reading. Your report is prepared from your own birth details in your chosen language." },
  ru: { eyebrow: "ЗАГЛЯНИТЕ В ОТЧЁТ", title: "Несколько страниц — чтобы увидеть больше.", body: "Посмотрите, как выглядит PDF: обложка с небесными мотивами, натальная карта и наглядная линия периодов. Эти три страницы подготовлены для Елены Марин — вымышленного человека с вымышленными данными рождения.", badge: "ВЫМЫШЛЕННЫЙ ПРИМЕР · НА АНГЛИЙСКОМ", pages: ["Иллюстрированная обложка", "Ваша карта в деталях", "Ваша линия времени"], descriptions: ["Небесные мотивы и персональная обложка.", "Расчётная карта D1 с положениями планет.", "Расчётные периоды, понятные даты и небольшие шаги для осмысления."], open: "Открыть страницу", download: "Скачать пример из 3 страниц", note: "Это выбранные страницы образца, а не полный прогноз. Ваш отчёт будет подготовлен по вашим данным рождения на выбранном языке." },
  de: { eyebrow: "EIN BLICK IN IHREN BERICHT", title: "Einige Seiten. Ein klareres Bild.", body: "Sehen Sie das tatsächliche PDF-Layout: ein illustriertes Titelblatt, das Geburtshoroskop und eine übersichtliche Zeitlinie. Die drei ausgewählten Seiten zeigen Elena Marin, eine erfundene Person mit fiktiven Geburtsdaten.", badge: "FIKTIVES BEISPIEL · ENGLISCH", pages: ["Ein illustrierter Anfang", "Ihr Horoskop wird sichtbar", "Ihre Zeitlinie"], descriptions: ["Himmlische Motive und ein persönliches Titelblatt.", "Ein berechnetes D1-Horoskop mit Planetenpositionen.", "Berechnete Perioden, klare Daten und kleine Reflexionsschritte."], open: "Seite öffnen", download: "3-seitiges Beispiel herunterladen", note: "Ausgewählte Beispielseiten, keine vollständige Deutung. Ihr Bericht entsteht aus Ihren Geburtsdaten in Ihrer gewählten Sprache." },
  es: { eyebrow: "DENTRO DE TU INFORME", title: "Unas páginas. Una imagen más clara.", body: "Descubre el diseño real del PDF: una portada ilustrada, la carta natal y una línea de periodos clara. Estas tres páginas seleccionadas corresponden a Elena Marin, una persona ficticia con datos de nacimiento inventados.", badge: "EJEMPLO FICTICIO · EN INGLÉS", pages: ["Un comienzo ilustrado", "Tu carta, visible", "Tu línea del tiempo"], descriptions: ["Ilustraciones celestes y una portada personal.", "Una carta D1 calculada con posiciones planetarias.", "Periodos calculados, fechas claras y pequeños pasos para reflexionar."], open: "Abrir página", download: "Descargar el ejemplo de 3 páginas", note: "Páginas seleccionadas de un ejemplo, no una lectura completa. Tu informe se prepara con tus datos de nacimiento en el idioma elegido." },
} as const;

export default function ReportSample({ locale }: { locale: Locale }) {
  const t = copy[locale];
  useEffect(() => {
    if (window.location.hash !== "#sample-report") return;
    const frame = requestAnimationFrame(() => document.getElementById("sample-report")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <section id="sample-report" aria-labelledby="sample-report-title" className="scroll-mt-20 border-y border-[#28231f]/10 bg-[#eae1d3] text-[#302a25]">
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#985033]">{t.eyebrow}</p><h2 id="sample-report-title" className="mt-4 max-w-lg font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{t.title}</h2></div>
        <div className="self-end"><p className="max-w-xl text-base leading-7 text-[#635a52]">{t.body}</p><p className="mt-4 text-[10px] font-semibold tracking-[0.12em] text-[#985033]">{t.badge}</p></div>
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-3 lg:gap-10">
        {t.pages.map((title, index) => <figure key={index} className="min-w-0">
          <a href={`/samples/reading-page-${index + 1}.webp?v=vedic-editorial-v2`} target="_blank" rel="noopener noreferrer" aria-label={`${t.open}: ${title}`} className="group block rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#985033]">
            <img src={`/samples/reading-page-${index + 1}.webp?v=vedic-editorial-v2`} alt={`${title} — Elena Marin (${t.badge})`} width={849} height={1200} loading="lazy" decoding="async" className="aspect-[595/842] w-full rounded-lg bg-[#fbf6ec] object-cover shadow-[0_12px_32px_-12px_#54473566] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none" />
          </a>
          <figcaption className="mt-5"><h3 className="flex items-center gap-2 font-serif text-xl"><span className="text-xs font-sans text-[#985033]">0{index + 1}</span>{title}<ArrowUpRight size={15} className="ml-auto shrink-0" aria-hidden="true" /></h3><p className="mt-2 text-sm leading-6 text-[#635a52]">{t.descriptions[index]}</p></figcaption>
        </figure>)}
      </div>
      <div className="mt-10 flex flex-col items-start gap-5 border-t border-[#302a25]/15 pt-7 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-[#635a52]">{t.note}</p>
        <a href="/samples/vedic-reading-sample.pdf?v=vedic-editorial-v2" download className="inline-flex shrink-0 items-center gap-3 rounded-full bg-[#302a25] px-6 py-3 text-sm font-medium text-[#fffaf4] hover:bg-[#554436] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#985033]"><Download size={16} aria-hidden="true" />{t.download}</a>
      </div>
    </div>
  </section>;
}
