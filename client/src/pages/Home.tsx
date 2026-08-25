import React, { FormEvent, useEffect, useState } from "react";
import { READING_PRICES } from "@shared/pricing";
import { formatCurrency, type SupportedCurrency } from "@shared/currency";
import { bookingSchema, getCheckoutErrorMessage } from "@shared/booking";
import { CHECKOUT_REDIRECT_DELAY_MS, getCheckoutButtonLabel, getCheckoutSuccessMessage } from "@shared/payment-ux";
import { COPY, Locale } from "@shared/i18n";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Mail,
  Share2,
  Gem,
  Globe2,
  Loader2,
  Menu,
  Moon,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";


const SUPPORTED_LOCALES: Locale[] = ["en", "ru", "de", "es"];
const LOCALE_LABELS: Record<Locale, string> = { en: "EN", ru: "RU", de: "DE", es: "ES" };
const privacyFormCopy: Record<Locale, { label: string; link: string; required: string }> = { en: { label: "I have read and accept the privacy information.", link: "Privacy & data protection", required: "Please read and accept the privacy information before submitting." }, ru: { label: "Я прочитал(а) и принимаю информацию о конфиденциальности.", link: "Конфиденциальность и данные", required: "Перед отправкой прочитайте и примите информацию о конфиденциальности." }, de: { label: "Ich habe die Datenschutzhinweise gelesen und akzeptiere sie.", link: "Datenschutz", required: "Bitte lesen und akzeptieren Sie die Datenschutzhinweise vor dem Absenden." }, es: { label: "He leído y acepto la información de privacidad.", link: "Privacidad y datos", required: "Lee y acepta la información de privacidad antes de enviar." } };
const themeCopy: Record<Locale, { dark: string; light: string }> = { en: { dark: "Dark mode", light: "Light mode" }, ru: { dark: "Тёмная тема", light: "Светлая тема" }, de: { dark: "Dunkler Modus", light: "Heller Modus" }, es: { dark: "Modo oscuro", light: "Modo claro" } };
const packageCopy: Record<Locale, { label: string; basic: string; basicPlus: string }> = { en: { label: "Choose your reading", basic: "Basic reading", basicPlus: "Basic + numerology" }, ru: { label: "Выберите чтение", basic: "Базовое чтение", basicPlus: "Базовое + нумерология" }, de: { label: "Lesung auswählen", basic: "Basisdeutung", basicPlus: "Basisdeutung + Numerologie" }, es: { label: "Elige tu lectura", basic: "Lectura básica", basicPlus: "Básica + numerología" } };
export function resolveLocale(value: string | null | undefined): Locale { return SUPPORTED_LOCALES.includes(value as Locale) ? value as Locale : "en"; }
function getInitialLocale() { const queryLocale = new URLSearchParams(window.location.search).get("lang"); return queryLocale ? resolveLocale(queryLocale) : resolveLocale(window.localStorage.getItem("public-locale")); }
function base64ToFile(contentBase64: string, filename: string, contentType: string) { const bytes = Uint8Array.from(window.atob(contentBase64), (character) => character.charCodeAt(0)); return new File([bytes], filename, { type: contentType }); }
function downloadBase64File(contentBase64: string, filename: string, contentType: string) { const file = base64ToFile(contentBase64, filename, contentType); const url = window.URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => window.URL.revokeObjectURL(url), 0); }

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const copy = COPY[locale];
  const { theme, toggleTheme } = useTheme();
  const isDarkTheme = theme === "dark";
  const themeLabel = isDarkTheme ? themeCopy[locale].light : themeCopy[locale].dark;
  const serviceHighlights = [...copy.features, copy.highlightQuestions];
  const faqs = copy.faqs;
  const [addon, setAddon] = useState(false);
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [submitted, setSubmitted] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [formError, setFormError] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptFilename, setReceiptFilename] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptEmailSent, setReceiptEmailSent] = useState(false);
  const [receiptCooldownUntil, setReceiptCooldownUntil] = useState(0);
  const [receiptPdfBase64, setReceiptPdfBase64] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharingReceipt, setSharingReceipt] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [consentErrorPulse, setConsentErrorPulse] = useState(0);
  const { data: pricing } = trpc.pricing.current.useQuery({ currency });
  const basicPrice = pricing?.basicUsd ?? READING_PRICES.basic;
  const addonPrice = pricing?.numerologyAddonUsd ?? READING_PRICES.numerologyAddon;
  const submitBooking = trpc.booking.submit.useMutation({
    onSuccess: (result) => {
      setFormError("");
      setPaymentUrl(result.invoiceUrl);
      setSubmitted(true);
      setRedirecting(true);
    },
    onError: (error) => {
      setFormError(getCheckoutErrorMessage(error.message));
    },
  });

  const total = basicPrice + (addon ? addonPrice : 0);
  const pricingBreakdownPdf = trpc.pricing.breakdownPdf.useMutation({ onSuccess: (result) => { const absoluteUrl = new URL(result.url, window.location.origin).toString(); setReceiptUrl(absoluteUrl); setReceiptPdfBase64(result.contentBase64); setReceiptFilename(result.filename); setLinkCopied(false); downloadBase64File(result.contentBase64, result.filename, "application/pdf"); }, onError: (error) => setFormError(getCheckoutErrorMessage(error.message)) });
  const emailReceipt = trpc.pricing.emailBreakdownPdf.useMutation({ onSuccess: () => { setReceiptEmailSent(true); setFormError(""); const until = Date.now() + 60_000; setReceiptCooldownUntil(until); window.setTimeout(() => setReceiptCooldownUntil(0), 60_000); }, onError: (error) => setFormError(error?.data?.code === "TOO_MANY_REQUESTS" ? copy.receiptEmailCooldown : copy.receiptEmailFailed) });

  function changeLocale(next: Locale) { setLocale(next); window.localStorage.setItem("public-locale", next); const url = new URL(window.location.href); url.searchParams.set("lang", next); window.history.replaceState({}, "", url.toString()); }

  useEffect(() => { window.localStorage.setItem("public-locale", locale); }, [locale]);

  useEffect(() => {
    if (!redirecting || !paymentUrl) return;
    const timer = window.setTimeout(() => window.location.assign(paymentUrl), CHECKOUT_REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [paymentUrl, redirecting]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = bookingSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      birthDate: form.get("birthDate"),
      birthTime: form.get("birthTime"),
      birthCity: form.get("birthCity"),
      birthCountry: form.get("birthCountry"),
      language: form.get("language"),
      addon,
      currency,
      interest: form.get("interest") || undefined,
    });

    if (!privacyAccepted) { setFormError(""); setConsentError(true); setConsentErrorPulse((current) => current + 1); return; }
    setConsentError(false);
    if (!parsed.success) {
      setConsentError(false);
      setFormError(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }

    setFormError("");
    setReceiptEmail(String(parsed.data.email));
    setReceiptEmailSent(false);
    submitBooking.mutate(parsed.data);
  }

  const currencyLabel = { en: "Currency", ru: "Валюта", de: "Währung", es: "Moneda" }[locale];
  const formattedBasicPrice = formatCurrency(basicPrice, currency, locale);
  const formattedAddonPrice = formatCurrency(addonPrice, currency, locale);
  const formattedTotal = formatCurrency(total, currency, locale);
  function receiptLabels() { return { title: copy.priceBreakdown, currency: currencyLabel, basic: copy.priceBasic, addon: copy.priceAddon, addonNotSelected: copy.priceAddonNotSelected, total: copy.priceTotal, generated: copy.generatedAt, disclaimer: copy.legalDisclaimer }; }
  function downloadBreakdownPdf() { setFormError(""); pricingBreakdownPdf.mutate({ currency, locale, addon, labels: receiptLabels() }); }
  function sendReceiptByEmail(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (receiptCooldownUntil > Date.now()) { setFormError(copy.receiptEmailCooldown); return; } setFormError(""); emailReceipt.mutate({ email: receiptEmail.trim(), currency, locale, addon, language: ({ en: "English", ru: "Русский", de: "Deutsch", es: "Español" } as const)[locale], labels: receiptLabels() }); }
  async function copyReceiptLink() { if (!receiptUrl) return; try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(receiptUrl); else { const textarea = document.createElement("textarea"); textarea.value = receiptUrl; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove(); } setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 2600); } catch { setFormError("Unable to copy the receipt link. Please copy it from the address field."); } }
  async function shareReceipt() { if (!receiptUrl || sharingReceipt) return; setSharingReceipt(true); try { const file = receiptPdfBase64 && receiptFilename ? base64ToFile(receiptPdfBase64, receiptFilename, "application/pdf") : null; const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] })); if (navigator.share) { await navigator.share(canShareFile && file ? { files: [file], title: copy.shareReceipt, text: receiptUrl } : { title: copy.shareReceipt, text: copy.shareReceipt, url: receiptUrl }); } else { await copyReceiptLink(); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setFormError(copy.shareUnavailable); } finally { setSharingReceipt(false); } }
  const currencySymbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";

  return (
    <div className={`public-page min-h-screen overflow-x-hidden text-[#28231f] ${isDarkTheme ? "theme-dark" : "theme-light"}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDarkTheme ? "border-[#544238] bg-[#201a16]/90" : "border-[#28231f]/10 bg-[#f8f5f0]/90"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Jyotish home">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#b55b39] text-[#fffaf4] shadow-[0_8px_24px_rgba(181,91,57,0.22)]">
              <Sun size={19} strokeWidth={1.6} />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">Jyotish · by Anika</span>
          </a>
          <nav className={`hidden items-center gap-8 text-sm font-medium md:flex ${isDarkTheme ? "text-[#ddcabe]" : "text-[#635a52]"}`}>
            <a className="transition-colors hover:text-[#b55b39]" href="#reading">{copy.navReading}</a>
            <a className="transition-colors hover:text-[#b55b39]" href="#process">{copy.navHow}</a>
            <a className="transition-colors hover:text-[#b55b39]" href="#faq">{copy.navFaq}</a>
            <select aria-label={copy.localeLabel} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} className={`rounded-full border bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] outline-none ${isDarkTheme ? "border-[#705544] text-[#f0c7ae]" : "border-[#28231f]/15 text-[#28231f]"}`}><option value="en">EN</option><option value="ru">RU</option><option value="de">DE</option><option value="es">ES</option></select>
            <button type="button" aria-label={themeLabel} title={themeLabel} onClick={() => toggleTheme?.()} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${isDarkTheme ? "border-[#705544] bg-[#3a2b25] text-[#f0c7ae] hover:bg-[#51382d]" : "border-[#28231f]/15 bg-white/70 text-[#635a52] hover:bg-[#f0e7df]"}`}>{isDarkTheme ? <Sun size={15} /> : <Moon size={15} />}<span className="hidden lg:inline">{themeLabel}</span></button><a className="rounded-full bg-[#28231f] px-5 py-2.5 text-[#fffaf4] transition-transform hover:-translate-y-0.5" href="#book">{copy.book}</a>
          </nav>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className={`border-t px-5 py-4 md:hidden ${isDarkTheme ? "border-[#544238] bg-[#201a16]" : "border-[#28231f]/10 bg-[#f8f5f0]"}`}>
            <div className="flex flex-col gap-4 text-sm font-medium">
              <a href="#reading" onClick={() => setMenuOpen(false)}>{copy.navReading}</a>
              <a href="#process" onClick={() => setMenuOpen(false)}>{copy.navHow}</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>{copy.navFaq}</a>
              <label className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${isDarkTheme ? "border-[#705544] text-[#f0c7ae]" : "border-[#28231f]/15 text-[#28231f]"}`}>{copy.localeLabel}: <select aria-label={copy.localeLabel} value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} className="bg-transparent outline-none"><option value="en">EN</option><option value="ru">RU</option><option value="de">DE</option><option value="es">ES</option></select></label>
              <button type="button" aria-label={themeLabel} title={themeLabel} onClick={() => toggleTheme?.()} className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold ${isDarkTheme ? "border-[#705544] bg-[#3a2b25] text-[#f0c7ae]" : "border-[#28231f]/15 bg-white/70 text-[#635a52]"}`}>{isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}{themeLabel}</button><a className="rounded-full bg-[#28231f] px-4 py-3 text-center text-[#fffaf4]" href="#book" onClick={() => setMenuOpen(false)}>{copy.book}</a>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden border-b border-[#28231f]/10">
          <div className="absolute -right-40 -top-32 -z-10 h-[35rem] w-[35rem] rounded-full bg-[#d9a441]/20 blur-3xl" />
          <div className="absolute -left-48 bottom-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#b55b39]/10 blur-3xl" />
          <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b55b39]/25 bg-[#fffaf4]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b55b39]">
                <Sparkles size={14} /> {copy.badge}
              </div>
              <h1 className="max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-[#28231f] sm:text-6xl lg:text-8xl">
                <>{copy.heroTitle}</>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#635a52] sm:text-xl">
                {copy.heroBody}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#book" className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#b55b39] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] shadow-[0_12px_30px_rgba(181,91,57,0.2)] transition-transform hover:-translate-y-1">
                  {copy.begin} <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a href="#reading" className="inline-flex items-center justify-center rounded-full border border-[#28231f]/20 px-6 py-3.5 text-sm font-semibold text-[#28231f] transition-colors hover:bg-[#fffaf4]">{copy.explore}</a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#776d63]">
                <span className="flex items-center gap-2"><Globe2 size={16} className="text-[#b55b39]" /> {copy.features[0]}</span>
                <span className="flex items-center gap-2"><FileText size={16} className="text-[#b55b39]" /> {copy.features[1]}</span>
                <span className="flex items-center gap-2"><Clock3 size={16} className="text-[#b55b39]" /> {copy.features[2]}</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[500px]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-[#312820] p-5 shadow-[0_28px_80px_rgba(40,35,31,0.22)] sm:p-7">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_38%,rgba(225,176,70,0.42),transparent_25%),radial-gradient(circle_at_70%_80%,rgba(181,91,57,0.45),transparent_35%)]" />
                <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-[#fffaf4]/20 p-6 text-[#fffaf4] sm:p-8">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#e8d9c0]">
                    <span>{copy.rasiChart}</span><span>01 / 01</span>
                  </div>
                  <div className="relative mx-auto aspect-square w-[82%] rounded-full border border-[#e8d9c0]/60 p-5">
                    <div className="grid h-full place-items-center rounded-full border border-[#e8d9c0]/30">
                      <div className="h-2/3 w-2/3 rotate-45 border border-[#e8d9c0]/60" />
                      <div className="absolute h-2/3 w-[1px] bg-[#e8d9c0]/45" />
                      <div className="absolute h-[1px] w-2/3 bg-[#e8d9c0]/45" />
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl text-[#e1b046]">✦</span>
                      <span className="absolute bottom-1/2 -right-3 translate-y-1/2 text-xl text-[#e1b046]">☽</span>
                      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xl text-[#e1b046]">✧</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-serif text-3xl">{copy.patternTitle}</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#e8d9c0]">{copy.patternBody}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 grid h-24 w-24 place-items-center rounded-2xl border border-[#e1b046]/40 bg-[#fffaf4] text-center shadow-xl">
                <div><p className="font-serif text-2xl text-[#b55b39]">{formattedBasicPrice}</p><p className="text-[10px] uppercase tracking-widest text-[#776d63]">{copy.basicLabel}</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="reading" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">{copy.offering}</p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{copy.offeringTitle}</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#635a52]">{copy.offeringBody}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl bg-[#fffaf4] p-7 shadow-sm ring-1 ring-[#28231f]/8 sm:col-span-2">
                <div className="flex items-start justify-between gap-5"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1dfd6] text-[#b55b39]"><Moon size={22} /></div><span className="font-serif text-3xl">{formattedBasicPrice}</span></div>
                <h3 className="mt-7 font-serif text-2xl">{copy.basicTitle}</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#635a52]">{copy.basicBody}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {serviceHighlights.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-[#635a52]"><Check size={16} className="shrink-0 text-[#b55b39]" />{item}</div>)}
                </div>
              </article>
              <article className="rounded-3xl border border-[#d9a441]/35 bg-[#f4ead5] p-7 sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:gap-8">
                <div><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9a441]/20 text-[#9c7012]"><Gem size={20} /></div><span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c7012]">{copy.optional}</span></div><h3 className="mt-4 font-serif text-2xl">{copy.addOn}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-[#675944]">{copy.addOnBody}</p></div><div className="mt-6 shrink-0 font-serif text-3xl text-[#9c7012] sm:mt-0">+{formattedAddonPrice}</div>
              </article>
            </div>
          </div>
        </section>

        <section id="process" className="border-y border-[#28231f]/10 bg-[#efe9df]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">{copy.process}</p><h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.processTitle}</h2></div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {copy.steps.map((step, index) => ({ n: String(index + 1).padStart(2, "0"), ...step })).map((step) => <div key={step.n} className="border-t border-[#28231f]/20 pt-5"><span className="font-mono text-xs text-[#b55b39]">{step.n}</span><h3 className="mt-8 font-serif text-2xl">{step.title}</h3><p className="mt-3 text-sm leading-7 text-[#635a52]">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="book" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">{copy.bookSection}</p><h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">{copy.bookTitle}</h2><p className="mt-5 max-w-md text-base leading-7 text-[#635a52]">{copy.bookBody}</p><div className="mt-8 rounded-2xl border border-[#28231f]/10 bg-[#fffaf4] p-5 text-sm leading-6 text-[#635a52]"><strong className="text-[#28231f]">{copy.noteHeading}</strong> {copy.note}<p className="mt-3 border-t border-[#28231f]/10 pt-3 text-xs leading-5 text-[#776d63]">{copy.legalDisclaimer}</p></div></div>
            <div className="rounded-[2rem] bg-[#28231f] p-6 text-[#fffaf4] shadow-[0_24px_70px_rgba(40,35,31,0.18)] sm:p-9">
              {submitted ? <div className="flex min-h-[520px] flex-col items-center justify-center text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#d9a441] text-[#28231f]"><Check size={30} /></div><h3 className="mt-7 font-serif text-4xl">{copy.successTitle}</h3><p className="mt-4 max-w-md leading-7 text-[#e8d9c0]">{copy.checkoutSuccess(total, formattedTotal)}</p><form onSubmit={sendReceiptByEmail} className="mt-7 w-full max-w-md rounded-2xl border border-[#fffaf4]/15 bg-[#fffaf4]/5 p-4 text-left"><label className="block text-sm text-[#e8d9c0]">{copy.sendReceiptEmail}<input required type="email" value={receiptEmail} onChange={(event) => { setReceiptEmail(event.target.value); setReceiptEmailSent(false); }} placeholder={copy.receiptEmailPlaceholder} className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" /></label><button type="submit" disabled={emailReceipt.isPending || receiptCooldownUntil > Date.now()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#e1b046]/50 px-4 py-3 text-sm font-semibold text-[#e1b046] hover:bg-[#e1b046]/10 disabled:cursor-wait disabled:opacity-60"><Mail size={15} /> {emailReceipt.isPending ? copy.sendingReceiptEmail : copy.sendReceiptEmail}</button>{receiptEmailSent && <p role="status" className="mt-2 text-xs text-emerald-200">{copy.receiptEmailSent}</p>}{formError && <p role="alert" className="mt-2 text-xs text-red-200">{formError}</p>}</form><a href={paymentUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#e1b046] px-5 py-3 text-sm font-bold text-[#28231f] hover:-translate-y-0.5">{copy.continueCheckout} <ArrowRight size={16} /></a><button className="mt-4 rounded-full border border-[#fffaf4]/30 px-5 py-3 text-sm font-semibold text-[#fffaf4] hover:bg-[#fffaf4]/10" onClick={() => { setSubmitted(false); setPaymentUrl(""); setRedirecting(false); setReceiptEmailSent(false); }}>{copy.anotherRequest}</button></div> : <form onSubmit={handleSubmit} className="space-y-6"><div className="flex items-start justify-between gap-4 border-b border-[#fffaf4]/15 pb-6"><div><p className="text-xs uppercase tracking-[0.18em] text-[#e1b046]">{copy.requestReading}</p><h3 className="mt-2 font-serif text-3xl">{copy.birthDetails}</h3></div><div className="text-right"><p className="font-serif text-3xl">{formattedTotal}</p><p className="text-xs text-[#cdbfae]">{copy.pdfReading}{addon ? " + add-on" : ""}</p></div></div><div role="group" className="rounded-2xl border border-[#fffaf4]/15 bg-[#fffaf4]/5 p-4" aria-label={copy.priceBreakdown}><div className="flex items-center justify-between gap-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e1b046]">{copy.priceBreakdown}</p><span className="text-xs text-[#cdbfae]">{currency}</span></div><dl className="mt-3 space-y-2 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-[#cdbfae]"><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help border-b border-dotted border-[#cdbfae]/70 text-left focus:outline-none focus:ring-2 focus:ring-[#e1b046] focus:ring-offset-2 focus:ring-offset-[#28231f]">{copy.priceBasic}</button></TooltipTrigger><TooltipContent side="top" className="max-w-xs">{copy.priceBasicHint}</TooltipContent></Tooltip></dt><dd className="font-semibold text-[#fffaf4]">{formattedBasicPrice}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-[#cdbfae]"><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help border-b border-dotted border-[#cdbfae]/70 text-left focus:outline-none focus:ring-2 focus:ring-[#e1b046] focus:ring-offset-2 focus:ring-offset-[#28231f]">{copy.priceAddon}{addon ? "" : ` · ${copy.priceAddonNotSelected}`}</button></TooltipTrigger><TooltipContent side="top" className="max-w-xs">{copy.priceAddonHint}</TooltipContent></Tooltip></dt><dd className="font-semibold text-[#fffaf4]">{addon ? `+${formattedAddonPrice}` : formatCurrency(0, currency, locale)}</dd></div><div className="flex items-center justify-between gap-4 border-t border-[#fffaf4]/15 pt-2"><dt className="font-semibold text-[#fffaf4]"><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help border-b border-dotted border-[#fffaf4]/70 text-left focus:outline-none focus:ring-2 focus:ring-[#e1b046] focus:ring-offset-2 focus:ring-offset-[#28231f]">{copy.priceTotal}</button></TooltipTrigger><TooltipContent side="top" className="max-w-xs">{copy.priceTotalHint}</TooltipContent></Tooltip></dt><dd className="font-serif text-xl text-[#e1b046]">{formattedTotal}</dd></div></dl><button type="button" onClick={downloadBreakdownPdf} disabled={pricingBreakdownPdf.isPending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#e1b046]/50 px-4 py-2.5 text-xs font-semibold text-[#e1b046] transition-colors hover:bg-[#e1b046]/10 disabled:cursor-wait disabled:opacity-60"><Download size={14} /> {pricingBreakdownPdf.isPending ? copy.downloadingBreakdown : copy.downloadBreakdown}</button>{receiptUrl && <div className="mt-4 rounded-xl border border-[#e1b046]/25 bg-[#fffaf4]/5 p-3"><p className="text-xs font-semibold text-[#e1b046]">{copy.shareReceipt}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void shareReceipt()} disabled={sharingReceipt} className="inline-flex items-center gap-1.5 rounded-full bg-[#e1b046] px-3 py-1.5 text-xs font-semibold text-[#28231f] disabled:cursor-wait disabled:opacity-60"><Share2 size={13} /> {sharingReceipt ? copy.sharingReceipt : copy.shareNative}</button><a href={`https://wa.me/?text=${encodeURIComponent(`${copy.shareReceipt}: ${receiptUrl}`)}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#fffaf4]/20 px-3 py-1.5 text-xs font-semibold text-[#fffaf4] hover:bg-[#fffaf4]/10">{copy.shareWhatsApp}</a><a href={`https://t.me/share/url?url=${encodeURIComponent(receiptUrl)}&text=${encodeURIComponent(copy.shareReceipt)}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#fffaf4]/20 px-3 py-1.5 text-xs font-semibold text-[#fffaf4] hover:bg-[#fffaf4]/10">{copy.shareTelegram}</a><button type="button" onClick={() => void copyReceiptLink()} className="rounded-full bg-[#e1b046] px-3 py-1.5 text-xs font-semibold text-[#28231f]">{linkCopied ? copy.linkCopied : copy.copyReceiptLink}</button></div></div>}</div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm text-[#e8d9c0]">{copy.name}<input required name="name" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder={copy.placeholderName} /></label><label className="text-sm text-[#e8d9c0]">{copy.email}<input required type="email" name="email" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="you@example.com" /></label><label className="text-sm text-[#e8d9c0]"><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help border-b border-dotted border-[#e8d9c0]/70 text-left focus:outline-none focus:ring-2 focus:ring-[#e1b046] focus:ring-offset-2 focus:ring-offset-[#28231f]">{copy.date}</button></TooltipTrigger><TooltipContent side="top" className="max-w-xs">{copy.dateHint}</TooltipContent></Tooltip><input required aria-label={copy.date} type="date" name="birthDate" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]" /></label><label className="text-sm text-[#e8d9c0]"><Tooltip><TooltipTrigger asChild><button type="button" className="cursor-help border-b border-dotted border-[#e8d9c0]/70 text-left focus:outline-none focus:ring-2 focus:ring-[#e1b046] focus:ring-offset-2 focus:ring-offset-[#28231f]">{copy.time}</button></TooltipTrigger><TooltipContent side="top" className="max-w-xs">{copy.timeHint}</TooltipContent></Tooltip><input required aria-label={copy.time} type="time" name="birthTime" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]" /></label><label className="text-sm text-[#e8d9c0]">{copy.city}<input required name="birthCity" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder={copy.placeholderCity} /></label><label className="text-sm text-[#e8d9c0]">{copy.country}<input required name="birthCountry" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder={copy.placeholderCountry} /></label></div><label className="block text-sm text-[#e8d9c0]">{copy.language}<select name="language" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]"><option className="text-[#28231f]">English</option><option className="text-[#28231f]">Русский</option><option className="text-[#28231f]">Deutsch</option><option className="text-[#28231f]">Español</option></select></label><label className="block text-sm text-[#e8d9c0]">{currencyLabel}<select aria-label={currencyLabel} value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "EUR" | "GBP")} className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]"><option className="text-[#28231f]" value="USD">USD ($)</option><option className="text-[#28231f]" value="EUR">EUR (€)</option><option className="text-[#28231f]" value="GBP">GBP (£)</option></select></label><fieldset className="rounded-2xl border border-[#fffaf4]/15 bg-[#fffaf4]/5 p-4"><legend className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#e1b046]">{packageCopy[locale].label}</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${!addon ? "border-[#e1b046] bg-[#e1b046]/10" : "border-[#fffaf4]/15"}`}><input aria-label={packageCopy[locale].basic} type="radio" name="package" checked={!addon} onChange={() => setAddon(false)} className="mt-1 h-4 w-4 accent-[#d9a441]" /><span><span className="block text-sm font-semibold text-[#fffaf4]">{packageCopy[locale].basic}</span><span className="mt-1 block text-xs leading-5 text-[#cdbfae]">{copy.basicBody}</span><span className="mt-1 block text-sm font-semibold text-[#e1b046]">{formattedBasicPrice}</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${addon ? "border-[#e1b046] bg-[#e1b046]/10" : "border-[#fffaf4]/15"}`}><input aria-label={packageCopy[locale].basicPlus} type="radio" name="package" checked={addon} onChange={() => setAddon(true)} className="mt-1 h-4 w-4 accent-[#d9a441]" /><span><span className="block text-sm font-semibold text-[#fffaf4]">{packageCopy[locale].basicPlus} <span className="text-[#e1b046]">+{formattedAddonPrice}</span></span><span className="mt-1 block text-xs leading-5 text-[#cdbfae]">{copy.addOnBody}</span><span className="mt-1 block text-sm font-semibold text-[#e1b046]">{formattedTotal}</span></span></label></div></fieldset><label aria-hidden="true" className="sr-only"><input aria-hidden="true" tabIndex={-1} type="checkbox" checked={addon} readOnly /></label><label className="block text-sm text-[#e8d9c0]">{copy.interest}<textarea name="interest" rows={3} className="mt-2 w-full resize-none rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder={copy.optionalInterest} /></label>{formError && !consentError && <p role="alert" className="rounded-xl border border-red-300/40 bg-red-900/20 px-4 py-3 text-sm text-[#ffd8cf]">{formError}</p>}<label key={consentErrorPulse} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-xs leading-5 transition-colors ${consentError ? "border-red-300 bg-red-900/25 text-[#fff1ee] consent-error-shake" : "border-[#fffaf4]/15 bg-[#fffaf4]/5 text-[#cdbfae]"}`}><input id="privacy-consent" aria-label="privacy consent" type="checkbox" checked={privacyAccepted} onChange={(event) => { const checked = event.target.checked; setPrivacyAccepted(checked); if (checked) { setConsentError(false); setFormError(""); } }} aria-invalid={consentError} aria-required="true" aria-describedby={consentError ? "privacy-consent-error" : undefined} className={`mt-1 h-4 w-4 accent-[#d9a441] ${consentError ? "ring-2 ring-red-300 ring-offset-2 ring-offset-[#28231f]" : ""}`} /><span>{privacyFormCopy[locale].label} <Link href="/privacy" className="text-[#e1b046] underline underline-offset-2">{privacyFormCopy[locale].link}</Link>{consentError && <span id="privacy-consent-error" role="alert" className="mt-2 block font-semibold text-[#ffd8cf]">{privacyFormCopy[locale].required}</span>}</span></label><button type="submit" disabled={submitBooking.isPending} className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#e1b046] px-6 py-4 text-sm font-bold text-[#28231f] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">{submitBooking.isPending ? <><Loader2 size={17} className="animate-spin" /> {copy.checkoutPending}</> : <>{copy.request} <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></>}</button><p className="text-center text-xs leading-5 text-[#b9aa97]">{copy.privacy} <Link href="/privacy" className="text-[#e1b046] underline underline-offset-2">{privacyFormCopy[locale].link}</Link></p></form>}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-[#28231f]/10 bg-[#fffaf4]">
          <div className="mx-auto max-w-4xl px-5 py-20 lg:px-8 lg:py-24"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">{copy.questionsLabel}</p><h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">{copy.questionsTitle}</h2></div><div className="mt-12 divide-y divide-[#28231f]/10">{faqs.map((faq, index) => <div key={faq.question} className="py-5"><button className="flex w-full items-center justify-between gap-6 text-left font-serif text-xl" onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<ChevronDown size={20} className={`shrink-0 text-[#b55b39] transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <p className="max-w-3xl pr-8 pt-4 text-sm leading-7 text-[#635a52]">{faq.answer}</p>}</div>)}</div></div>
        </section>
      </main>

      <footer className="bg-[#28231f] text-[#fffaf4]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p className="font-serif text-2xl">Jyotish · by Anika</p><p className="mt-2 text-sm text-[#cdbfae]">{copy.footerBody}</p></div><div className="text-xs text-[#a99b89]"><p>© {new Date().getFullYear()} · {copy.footerNote}</p><Link href="/privacy" className="mt-2 inline-block text-[#e1b046] underline underline-offset-2">{privacyFormCopy[locale].link}</Link></div></div></footer>
    </div>
  );
}
