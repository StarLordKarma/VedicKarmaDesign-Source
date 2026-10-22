import type { Express, RequestHandler } from "express";
import { isPublicPage, pageMetadata, publicPageUrl, publicStructuredData, PUBLIC_PAGE_PATHS, SEO_LOCALES, seoCopy, seoLocale, SITE_ORIGIN, SOCIAL_IMAGE, type SeoLocale } from "../../shared/seo";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export const searchIndexingHeaders: RequestHandler = (req, res, next) => {
  if (/^\/(api|pay|status|admin|owner-login|health|ready)(\/|$)/i.test(req.path)) res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
};
export function sitemapXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PAGE_PATHS.flatMap(path => SEO_LOCALES.map(locale => `<url><loc>${escapeHtml(publicPageUrl(path, locale))}</loc></url>`)).join("\n")}\n</urlset>\n`;
}
export function registerSearchRoutes(app: Express) {
  app.get("/robots.txt", (_req, res) => {
    // Allow crawling private HTML so robots can read noindex; access control remains independent.
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  });
  app.get("/sitemap.xml", (_req, res) => res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(sitemapXml()));
}
function overview(locale: SeoLocale) {
  const t = seoCopy[locale];
  const nav = SEO_LOCALES.map(lang => `<a href="${escapeHtml(publicPageUrl("/", lang))}" hreflang="${lang}">${lang.toUpperCase()}</a>`).join(" · ");
  const pages = t.pages.map((title, i) => `<figure><img src="/samples/reading-page-${i + 1}.webp?v=vedic-editorial-v2" alt="${escapeHtml(title)}" width="280" loading="lazy" style="max-width:100%;height:auto"><figcaption>${escapeHtml(title)}</figcaption></figure>`).join("");
  return `<main style="max-width:1000px;margin:40px auto;padding:24px;color:#302a25;background:#fff9f0;font:18px/1.7 Georgia,serif"><p>Vedic Karma Design</p><nav>${nav}</nav><h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.intro)}</p><h2>${escapeHtml(t.sample)}</h2><p>${escapeHtml(t.sampleNote)}</p><div style="display:flex;flex-wrap:wrap;gap:16px">${pages}</div><a href="/samples/vedic-reading-sample.pdf?v=vedic-editorial-v2">${escapeHtml(t.openPdf)}</a><h2>${escapeHtml(t.packages)}</h2><p>${escapeHtml(t.packageText)}</p><p>${escapeHtml(t.delivery)}</p><noscript><p>${escapeHtml(t.javascript)}</p></noscript><footer><a href="${escapeHtml(publicPageUrl("/privacy", locale))}">${escapeHtml(t.privacy)}</a> · <a href="${escapeHtml(publicPageUrl("/refunds", locale))}">${escapeHtml(t.refunds)}</a></footer></main>`;
}
/** Identical initial HTML for visitors and crawlers. React replaces the overview on mount. */
export function renderPageHtml(template: string, requestUrl: string) {
  const url = new URL(requestUrl, SITE_ORIGIN);
  const locale = seoLocale(url.searchParams.get("lang"));
  const path = url.pathname;
  const indexable = isPublicPage(path);
  const meta = pageMetadata(path, locale);
  const canonical = indexable ? publicPageUrl(path, locale) : null;
  let head = `<title>${escapeHtml(meta.title)}</title>\n<meta name="description" content="${escapeHtml(meta.description)}">\n<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow, noarchive"}">`;
  if (canonical && isPublicPage(path)) {
    head += `\n<link rel="canonical" href="${escapeHtml(canonical)}">`;
    for (const lang of SEO_LOCALES) head += `\n<link rel="alternate" hreflang="${lang}" href="${escapeHtml(publicPageUrl(path, lang))}">`;
    head += `\n<link rel="alternate" hreflang="x-default" href="${escapeHtml(publicPageUrl(path, "en"))}">`;
    const ogLocale = { en: "en_US", ru: "ru_RU", de: "de_DE", es: "es_ES" }[locale];
    for (const [property, content] of Object.entries({ "og:type": "website", "og:site_name": "Vedic Karma Design", "og:locale": ogLocale, "og:title": meta.title, "og:description": meta.description, "og:url": canonical, "og:image": SOCIAL_IMAGE, "og:image:width": "1200", "og:image:height": "630", "og:image:alt": seoCopy[locale].sampleNote })) head += `\n<meta property="${property}" content="${escapeHtml(content)}">`;
    for (const [name, content] of Object.entries({ "twitter:card": "summary_large_image", "twitter:title": meta.title, "twitter:description": meta.description, "twitter:image": SOCIAL_IMAGE, "twitter:image:alt": seoCopy[locale].sampleNote })) head += `\n<meta name="${name}" content="${escapeHtml(content)}">`;
    if (path === "/") {
      const graph = publicStructuredData(locale);
      head += `\n<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
    }
  }
  return template.replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->${head}<!--seo:end-->`)
    .replace('<div id="root"></div>', `<div id="root">${path === "/" ? overview(locale) : ""}</div>`);
}
