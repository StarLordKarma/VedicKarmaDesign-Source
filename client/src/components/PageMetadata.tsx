import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { isPublicPage, pageMetadata, publicPageUrl, publicStructuredData, SEO_LOCALES, seoLocale, SOCIAL_IMAGE } from "@shared/seo";

export default function PageMetadata() {
  const [path] = useLocation();
  const search = useSearch();
  useEffect(() => {
    const update = () => {
      const locale = seoLocale(new URLSearchParams(window.location.search).get("lang"));
      const meta = pageMetadata(path, locale);
      const publicPage = isPublicPage(path);
      document.documentElement.lang = locale;
      document.title = meta.title;
      const setMeta = (key: string, content: string, property = false) => {
        const attr = property ? "property" : "name";
        let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
        if (!element) { element = document.createElement("meta"); element.setAttribute(attr, key); document.head.appendChild(element); }
        element.content = content;
      };
      setMeta("description", meta.description);
      setMeta("robots", publicPage ? "index, follow" : "noindex, nofollow, noarchive");
      document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]').forEach(el => el.remove());
      if (!isPublicPage(path)) return;
      const link = (rel: string, href: string, lang?: string) => {
        const el = document.createElement("link"); el.rel = rel; el.href = href;
        if (lang) el.hreflang = lang;
        document.head.appendChild(el);
      };
      const canonical = publicPageUrl(path, locale);
      link("canonical", canonical);
      for (const lang of SEO_LOCALES) link("alternate", publicPageUrl(path, lang), lang);
      link("alternate", publicPageUrl(path, "en"), "x-default");
      for (const [key, value] of Object.entries({ "og:type": "website", "og:site_name": "Vedic Karma Design", "og:title": meta.title, "og:description": meta.description, "og:url": canonical, "og:image": SOCIAL_IMAGE, "og:locale": { en: "en_US", ru: "ru_RU", de: "de_DE", es: "es_ES" }[locale] })) setMeta(key, value, true);
      for (const [key, value] of Object.entries({ "twitter:card": "summary_large_image", "twitter:title": meta.title, "twitter:description": meta.description, "twitter:image": SOCIAL_IMAGE })) setMeta(key, value);
      if (path === "/") {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.textContent = JSON.stringify(publicStructuredData(locale));
        document.head.appendChild(script);
      }
    };
    update();
    window.addEventListener("public-locale-changed", update);
    return () => window.removeEventListener("public-locale-changed", update);
  }, [path, search]);
  return null;
}
