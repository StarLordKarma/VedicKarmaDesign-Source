import { FormEvent, useState } from "react";
import { READING_PRICES } from "@shared/pricing";
import { bookingSchema, getCheckoutErrorMessage } from "@shared/booking";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Gem,
  Globe2,
  Menu,
  Moon,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";

const serviceHighlights = [
  "Multi-page PDF reading",
  "Clear, structured interpretation",
  "English, Russian, German & Spanish",
  "One round of clarification questions",
];

const faqs = [
  {
    question: "What details do I need to provide?",
    answer:
      "Please provide your place of birth (city and country), date of birth, and exact time of birth. The accuracy and completeness of the reading depend on the correctness of these details.",
  },
  {
    question: "What will I receive?",
    answer:
      "You will receive a detailed, multi-page PDF document with the main themes of your Vedic natal chart explained in clear language.",
  },
  {
    question: "What is included in the $10 add-on?",
    answer:
      "The add-on includes an Indian numerology overview, traditionally associated favorable and challenging days and numbers, and traditional gemstone suggestions.",
  },
  {
    question: "Is this medical, legal, or financial advice?",
    answer:
      "No. Astrology and numerology are interpretive practices for reflection and spiritual exploration. They are not a substitute for qualified professional advice.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addon, setAddon] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const submitBooking = trpc.booking.submit.useMutation({
    onSuccess: (result) => {
      setFormError("");
      setPaymentUrl(result.invoiceUrl);
      setSubmitted(true);
    },
    onError: (error) => {
      setFormError(getCheckoutErrorMessage(error.message));
    },
  });

  const total = READING_PRICES.basic + (addon ? READING_PRICES.numerologyAddon : 0);

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
      interest: form.get("interest") || undefined,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return;
    }

    setFormError("");
    submitBooking.mutate(parsed.data);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f5f0] text-[#28231f]">
      <header className="sticky top-0 z-50 border-b border-[#28231f]/10 bg-[#f8f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Jyotish home">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#b55b39] text-[#fffaf4] shadow-[0_8px_24px_rgba(181,91,57,0.22)]">
              <Sun size={19} strokeWidth={1.6} />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">Jyotish · by Anika</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#635a52] md:flex">
            <a className="transition-colors hover:text-[#b55b39]" href="#reading">The reading</a>
            <a className="transition-colors hover:text-[#b55b39]" href="#process">How it works</a>
            <a className="transition-colors hover:text-[#b55b39]" href="#faq">FAQ</a>
            <a className="rounded-full bg-[#28231f] px-5 py-2.5 text-[#fffaf4] transition-transform hover:-translate-y-0.5" href="#book">Book a reading</a>
          </nav>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#28231f]/10 bg-[#f8f5f0] px-5 py-4 md:hidden">
            <div className="flex flex-col gap-4 text-sm font-medium">
              <a href="#reading" onClick={() => setMenuOpen(false)}>The reading</a>
              <a href="#process" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
              <a className="rounded-full bg-[#28231f] px-4 py-3 text-center text-[#fffaf4]" href="#book" onClick={() => setMenuOpen(false)}>Book a reading</a>
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
                <Sparkles size={14} /> Vedic astrology · Jyotish
              </div>
              <h1 className="max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-[#28231f] sm:text-6xl lg:text-8xl">
                A clearer map for your <em className="font-normal text-[#b55b39]">inner sky.</em>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#635a52] sm:text-xl">
                A personalized Vedic birth chart reading, prepared with care and delivered as a detailed multi-page PDF for reflection, self-understanding, and spiritual exploration.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#book" className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#b55b39] px-6 py-3.5 text-sm font-semibold text-[#fffaf4] shadow-[0_12px_30px_rgba(181,91,57,0.2)] transition-transform hover:-translate-y-1">
                  Begin your reading <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a href="#reading" className="inline-flex items-center justify-center rounded-full border border-[#28231f]/20 px-6 py-3.5 text-sm font-semibold text-[#28231f] transition-colors hover:bg-[#fffaf4]">Explore the reading</a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#776d63]">
                <span className="flex items-center gap-2"><Globe2 size={16} className="text-[#b55b39]" /> 4 languages</span>
                <span className="flex items-center gap-2"><FileText size={16} className="text-[#b55b39]" /> Multi-page PDF</span>
                <span className="flex items-center gap-2"><Clock3 size={16} className="text-[#b55b39]" /> Personal & structured</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[500px]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-[#312820] p-5 shadow-[0_28px_80px_rgba(40,35,31,0.22)] sm:p-7">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_38%,rgba(225,176,70,0.42),transparent_25%),radial-gradient(circle_at_70%_80%,rgba(181,91,57,0.45),transparent_35%)]" />
                <div className="relative flex h-full flex-col justify-between rounded-[2rem] border border-[#fffaf4]/20 p-6 text-[#fffaf4] sm:p-8">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#e8d9c0]">
                    <span>Rasi chart</span><span>01 / 01</span>
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
                    <p className="font-serif text-3xl">Read the patterns.</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#e8d9c0]">A grounded interpretation of the symbols, houses, and planetary placements that shape your chart.</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 grid h-24 w-24 place-items-center rounded-2xl border border-[#e1b046]/40 bg-[#fffaf4] text-center shadow-xl">
                <div><p className="font-serif text-2xl text-[#b55b39]">${READING_PRICES.basic}</p><p className="text-[10px] uppercase tracking-widest text-[#776d63]">basic reading</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="reading" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">The offering</p>
              <h2 className="mt-4 max-w-md font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">A reading made to be returned to.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#635a52]">Your chart is translated into a calm, readable document — something you can sit with, revisit, and use as a prompt for reflection.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl bg-[#fffaf4] p-7 shadow-sm ring-1 ring-[#28231f]/8 sm:col-span-2">
                <div className="flex items-start justify-between gap-5"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1dfd6] text-[#b55b39]"><Moon size={22} /></div><span className="font-serif text-3xl">${READING_PRICES.basic}</span></div>
                <h3 className="mt-7 font-serif text-2xl">Basic Vedic chart reading</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#635a52]">A personal Jyotish natal chart interpretation, focused on key planetary placements, houses, strengths, tendencies, and areas for reflection.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {serviceHighlights.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-[#635a52]"><Check size={16} className="shrink-0 text-[#b55b39]" />{item}</div>)}
                </div>
              </article>
              <article className="rounded-3xl border border-[#d9a441]/35 bg-[#f4ead5] p-7 sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:gap-8">
                <div><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9a441]/20 text-[#9c7012]"><Gem size={20} /></div><span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c7012]">Optional add-on</span></div><h3 className="mt-4 font-serif text-2xl">Indian numerology & traditional symbols</h3><p className="mt-2 max-w-xl text-sm leading-6 text-[#675944]">Numerology overview, traditionally associated favorable and challenging days and numbers, plus traditional gemstone suggestions.</p></div><div className="mt-6 shrink-0 font-serif text-3xl text-[#9c7012] sm:mt-0">+${READING_PRICES.numerologyAddon}</div>
              </article>
            </div>
          </div>
        </section>

        <section id="process" className="border-y border-[#28231f]/10 bg-[#efe9df]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">The process</p><h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Simple to begin. Thoughtful in delivery.</h2></div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[{n:"01", title:"Share your birth details", text:"Provide your place of birth, date of birth, and exact time of birth. These details shape the accuracy and completeness of the chart interpretation."},{n:"02", title:"Receive your reading", text:"Your personalized interpretation is prepared as a detailed, multi-page PDF document in your preferred language."},{n:"03", title:"Return to the insight", text:"Read at your own pace and ask one round of clarification questions about the delivered document."}].map((step) => <div key={step.n} className="border-t border-[#28231f]/20 pt-5"><span className="font-mono text-xs text-[#b55b39]">{step.n}</span><h3 className="mt-8 font-serif text-2xl">{step.title}</h3><p className="mt-3 text-sm leading-7 text-[#635a52]">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="book" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">Book your reading</p><h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">Bring the right details.</h2><p className="mt-5 max-w-md text-base leading-7 text-[#635a52]">The city, country, date, and exact time of birth are required. The more accurate the information, the more precise and complete the chart interpretation can be.</p><div className="mt-8 rounded-2xl border border-[#28231f]/10 bg-[#fffaf4] p-5 text-sm leading-6 text-[#635a52]"><strong className="text-[#28231f]">A note on the practice.</strong> Astrology and numerology are interpretive practices for reflection and spiritual exploration, not medical, legal, financial, psychological, or professional advice.</div></div>
            <div className="rounded-[2rem] bg-[#28231f] p-6 text-[#fffaf4] shadow-[0_24px_70px_rgba(40,35,31,0.18)] sm:p-9">
              {submitted ? <div className="flex min-h-[520px] flex-col items-center justify-center text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-[#d9a441] text-[#28231f]"><Check size={30} /></div><h3 className="mt-7 font-serif text-4xl">Your request is received.</h3><p className="mt-4 max-w-md leading-7 text-[#e8d9c0]">Your request is saved. Continue to the secure crypto checkout to complete the ${total} payment.</p><a href={paymentUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#e1b046] px-5 py-3 text-sm font-bold text-[#28231f] hover:-translate-y-0.5">Continue to crypto checkout <ArrowRight size={16} /></a><button className="mt-4 rounded-full border border-[#fffaf4]/30 px-5 py-3 text-sm font-semibold text-[#fffaf4] hover:bg-[#fffaf4]/10" onClick={() => { setSubmitted(false); setPaymentUrl(""); }}>Send another request</button></div> : <form onSubmit={handleSubmit} className="space-y-6"><div className="flex items-start justify-between gap-4 border-b border-[#fffaf4]/15 pb-6"><div><p className="text-xs uppercase tracking-[0.18em] text-[#e1b046]">Request a reading</p><h3 className="mt-2 font-serif text-3xl">Your birth details</h3></div><div className="text-right"><p className="font-serif text-3xl">${total}</p><p className="text-xs text-[#cdbfae]">PDF reading{addon ? " + add-on" : ""}</p></div></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm text-[#e8d9c0]">Preferred name<input required name="name" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="Your name" /></label><label className="text-sm text-[#e8d9c0]">Email<input required type="email" name="email" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="you@example.com" /></label><label className="text-sm text-[#e8d9c0]">Date of birth<input required type="date" name="birthDate" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]" /></label><label className="text-sm text-[#e8d9c0]">Exact time of birth<input required type="time" name="birthTime" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]" /></label><label className="text-sm text-[#e8d9c0]">City of birth<input required name="birthCity" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="City" /></label><label className="text-sm text-[#e8d9c0]">Country of birth<input required name="birthCountry" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="Country" /></label></div><label className="block text-sm text-[#e8d9c0]">Preferred language<select name="language" className="mt-2 w-full rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none focus:border-[#e1b046]"><option className="text-[#28231f]">English</option><option className="text-[#28231f]">Русский</option><option className="text-[#28231f]">Deutsch</option><option className="text-[#28231f]">Español</option></select></label><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#fffaf4]/15 bg-[#fffaf4]/5 p-4"><input type="checkbox" checked={addon} onChange={(event) => setAddon(event.target.checked)} className="mt-1 h-4 w-4 accent-[#d9a441]" /><span><span className="block text-sm font-semibold text-[#fffaf4]">Add Indian numerology & traditional symbols <span className="text-[#e1b046]">+${READING_PRICES.numerologyAddon}</span></span><span className="mt-1 block text-xs leading-5 text-[#cdbfae]">Numerology overview, traditional days and numbers, and gemstone suggestions.</span></span></label><label className="block text-sm text-[#e8d9c0]">What would you like to reflect on?<textarea name="interest" rows={3} className="mt-2 w-full resize-none rounded-xl border border-[#fffaf4]/15 bg-[#fffaf4]/8 px-4 py-3 text-[#fffaf4] outline-none placeholder:text-[#b9aa97] focus:border-[#e1b046]" placeholder="Optional: themes, questions, or areas of interest" /></label>{formError && <p role="alert" className="rounded-xl border border-red-300/40 bg-red-900/20 px-4 py-3 text-sm text-[#ffd8cf]">{formError}</p>}<button type="submit" disabled={submitBooking.isPending} className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#e1b046] px-6 py-4 text-sm font-bold text-[#28231f] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">{submitBooking.isPending ? "Saving your request…" : "Request my reading"}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></button><p className="text-center text-xs leading-5 text-[#b9aa97]">Your details are used only to prepare and respond to your reading request. Payment is processed securely by NOWPayments; the site does not store wallet private keys.</p></form>}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-[#28231f]/10 bg-[#fffaf4]">
          <div className="mx-auto max-w-4xl px-5 py-20 lg:px-8 lg:py-24"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b55b39]">Questions</p><h2 className="mt-4 font-serif text-4xl tracking-[-0.03em] sm:text-5xl">Before you book</h2></div><div className="mt-12 divide-y divide-[#28231f]/10">{faqs.map((faq, index) => <div key={faq.question} className="py-5"><button className="flex w-full items-center justify-between gap-6 text-left font-serif text-xl" onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<ChevronDown size={20} className={`shrink-0 text-[#b55b39] transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <p className="max-w-3xl pr-8 pt-4 text-sm leading-7 text-[#635a52]">{faq.answer}</p>}</div>)}</div></div>
        </section>
      </main>

      <footer className="bg-[#28231f] text-[#fffaf4]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><p className="font-serif text-2xl">Jyotish · by Anika</p><p className="mt-2 text-sm text-[#cdbfae]">A thoughtful reading of your inner sky.</p></div><p className="text-xs text-[#a99b89]">© {new Date().getFullYear()} · Interpretive practice for reflection</p></div></footer>
    </div>
  );
}
