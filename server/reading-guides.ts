import type { Express } from "express";
import { GUIDE_PATHS, guideUi, readingGuide } from "../shared/reading-guides";
import { publicPageUrl, seoLocale, type SeoLocale } from "../shared/seo";
import { renderPageHtml } from "./_core/seo";

const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function guideNavigation(locale: SeoLocale) {
  return `<nav aria-label="${escape(guideUi[locale].label)}"><p>${escape(guideUi[locale].label)}</p><ul>${GUIDE_PATHS.map(path => `<li><a href="${escape(publicPageUrl(path, locale))}">${escape(readingGuide(path, locale)!.title)}</a></li>`).join("")}</ul></nav>`;
}

export function renderReadingGuide(path: string, locale: SeoLocale) {
  const guide = readingGuide(path, locale);
  if (!guide) return undefined;
  const ui = guideUi[locale];
  const template = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><!--seo:start--><!--seo:end--><style>body{margin:0;background:#faf6ef;color:#302a25;font:18px/1.8 system-ui,sans-serif}header,main,footer{max-width:760px;margin:auto;padding:24px}header{border-bottom:1px solid #d9cbbd}a{color:#82462f;text-underline-offset:3px}h1{font:clamp(2rem,5vw,3rem)/1.2 Georgia,serif}p{margin:1.3em 0}.note{font-size:.9rem;border-left:3px solid #a26d4b;padding-left:18px}.cta{display:inline-block;padding:12px 20px;border:1px solid #82462f;border-radius:8px}nav ul{padding-left:22px}a:focus-visible{outline:3px solid #82462f;outline-offset:4px}</style></head><body><header><a href="${escape(publicPageUrl("/", locale))}">Karma Life Design</a></header><main><article><h1>${escape(guide.title)}</h1>${guide.paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join("")}<p class="note">${escape(ui.note)}</p><a class="cta" href="${escape(publicPageUrl("/", locale))}#sample-${guide.view}">${escape(ui.sample)}</a></article>${guideNavigation(locale)}</main><footer><a href="${escape(publicPageUrl("/", locale))}">${escape(ui.home)}</a> · <a href="${escape(publicPageUrl("/privacy", locale))}">${escape(ui.privacy)}</a> · <a href="${escape(publicPageUrl("/refunds", locale))}">${escape(ui.refunds)}</a></footer></body></html>`;
  return renderPageHtml(template, path + (locale === "en" ? "" : `?lang=${locale}`));
}

export function registerReadingGuides(app: Express) {
  for (const path of GUIDE_PATHS) app.get(path, (req, res) => {
    const locale = seoLocale(typeof req.query.lang === "string" ? req.query.lang : undefined);
    res.set({ "Content-Language": locale, "Cache-Control": "public, max-age=3600" }).type("html").send(renderReadingGuide(path, locale));
  });
}
