import React, { useEffect, useState } from "react";

type Locale = "en" | "ru" | "de" | "es";
type VisitorChoice = "necessary" | "analytics";
const KEY = "visitor-privacy-choice-v1";
const LOCALES: Locale[] = ["en", "ru", "de", "es"];
const copy: Record<Locale, { title: string; body: string; essential: string; accept: string; decline: string; privacy: string }> = {
  en: { title: "Privacy choices", body: "We use essential browser storage for language, security and temporary form state. Optional analytics remain off unless you choose to enable them.", essential: "Use essential only", accept: "Allow optional analytics", decline: "Continue without analytics", privacy: "Read privacy information" },
  ru: { title: "Настройки конфиденциальности", body: "Мы используем обязательное хранилище браузера для языка, безопасности и временного состояния формы. Необязательная аналитика выключена, пока вы не включите её отдельно.", essential: "Только обязательное", accept: "Разрешить необязательную аналитику", decline: "Продолжить без аналитики", privacy: "Открыть информацию о конфиденциальности" },
  de: { title: "Datenschutzeinstellungen", body: "Wir verwenden erforderlichen Browserspeicher für Sprache, Sicherheit und temporäre Formularzustände. Optionale Analyse bleibt aus, bis Sie sie separat aktivieren.", essential: "Nur erforderliche Nutzung", accept: "Optionale Analyse erlauben", decline: "Ohne Analyse fortfahren", privacy: "Datenschutzhinweise lesen" },
  es: { title: "Preferencias de privacidad", body: "Usamos almacenamiento esencial del navegador para idioma, seguridad y estados temporales del formulario. La analítica opcional permanece desactivada hasta que la autorices por separado.", essential: "Usar solo lo esencial", accept: "Permitir analítica opcional", decline: "Continuar sin analítica", privacy: "Leer información de privacidad" },
};

function resolveLocale(value: string | null): Locale { return LOCALES.includes(value as Locale) ? value as Locale : "en"; }
function loadAnalytics() {
  if (document.querySelector('script[data-consent-analytics="true"]')) return;
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;
  if (!endpoint || !websiteId) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${endpoint}/umami`;
  script.dataset.websiteId = websiteId;
  script.dataset.consentAnalytics = "true";
  document.head.appendChild(script);
}

export default function VisitorPrivacyChoices() {
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(window.localStorage.getItem("public-locale")));
  const [choice, setChoice] = useState<VisitorChoice | null>(() => window.localStorage.getItem(KEY) as VisitorChoice | null);
  useEffect(() => { const update = () => setLocale(resolveLocale(window.localStorage.getItem("public-locale"))); window.addEventListener("public-locale-changed", update); window.addEventListener("storage", update); return () => { window.removeEventListener("public-locale-changed", update); window.removeEventListener("storage", update); }; }, []);
  useEffect(() => { if (choice === "analytics") loadAnalytics(); }, [choice]);
  if (choice === "necessary" || choice === "analytics") return null;
  const t = copy[locale];
  const choose = (value: VisitorChoice) => { window.localStorage.setItem(KEY, value); setChoice(value); };
  return <section role="dialog" aria-modal="false" aria-label={t.title} className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-3xl rounded-2xl border border-[#d8c8bd] bg-[#fffaf4] p-4 text-[#28231f] shadow-2xl sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-serif text-xl">{t.title}</p><p className="mt-1 max-w-xl text-sm leading-6 text-[#635a52]">{t.body}</p><a className="mt-2 inline-block text-xs font-semibold text-[#9b5439] underline" href={`/privacy?lang=${locale}`}>{t.privacy}</a></div><div className="flex flex-col gap-2 sm:min-w-[205px]"><button type="button" onClick={() => choose("analytics")} className="rounded-full bg-[#28231f] px-4 py-2.5 text-sm font-semibold text-[#fffaf4]">{t.accept}</button><button type="button" onClick={() => choose("necessary")} className="rounded-full border border-[#28231f]/20 px-4 py-2.5 text-sm font-semibold text-[#28231f]">{t.decline}</button><p className="text-center text-[10px] text-[#776d63]">{t.essential}</p></div></div></section>;
}
