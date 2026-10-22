import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { JSDOM } from "jsdom";
import { registerSearchRoutes, renderPageHtml, searchIndexingHeaders, sitemapXml } from "./seo";
import { serveStatic } from "./static";
import { publicPageUrl, PUBLIC_PAGE_PATHS, SEO_LOCALES, seoCopy } from "../../shared/seo";

const template = fs.readFileSync(path.resolve("client/index.html"), "utf8");
const doc = (url: string) => new JSDOM(renderPageHtml(template, url)).window.document;

describe("public search metadata", () => {
  it.each(SEO_LOCALES)("renders localized initial content and reciprocal alternatives for %s", locale => {
    const document = doc(`/?lang=${locale}&utm_source=test`);
    expect(document.documentElement.lang).toBe(locale);
    expect(document.title).toBe(seoCopy[locale].title);
    expect(document.querySelector("h1")?.textContent).toBe(seoCopy[locale].heading);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(publicPageUrl("/", locale));
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(5);
    expect(document.querySelectorAll("#root img")).toHaveLength(3);
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toMatch(/^https:.*\.jpg$/);
    const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(graph["@graph"].map((item: any) => item["@type"])).toEqual(["Organization", "Service"]);
    expect(JSON.stringify(graph)).not.toMatch(/rating|review|offers/i);
  });
  it("only advertises public canonical pages in the XML sitemap", () => {
    const document = new JSDOM(sitemapXml(), { contentType: "application/xml" }).window.document;
    const urls = [...document.querySelectorAll("loc")].map(el => el.textContent!);
    expect(urls).toHaveLength(12);
    expect(new Set(urls).size).toBe(12);
    expect(urls).toEqual(PUBLIC_PAGE_PATHS.flatMap(p => SEO_LOCALES.map(l => publicPageUrl(p, l))));
    expect(urls.join(" ")).not.toMatch(/pay\/|status\/|admin|token|utm_/);
  });
  it.each(["/pay/private-order-token", "/status/private-access-token", "/admin/refunds", "/owner-login", "/not-a-page"])("does not expose private URLs in metadata for %s", url => {
    const document = doc(`${url}?email=private%40example.com`);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex");
    expect(document.querySelector('link[rel="canonical"], meta[property="og:url"], script[type="application/ld+json"]')).toBeNull();
    expect(document.documentElement.outerHTML).not.toMatch(/private-order-token|private-access-token|private%40/);
  });
  it("does not reflect malformed languages or arbitrary host names", () => {
    const document = doc('https://attacker.example/?lang=%22%3E%3Cscript%3E&token=secret');
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://karmalifedesign.com/");
    expect(document.documentElement.outerHTML).not.toMatch(/attacker|token=secret/);
  });
  it.each(["/privacy", "/refunds"])("has separate localized titles for %s", url => {
    expect(doc(`${url}?lang=ru`).title).not.toBe(doc(`${url}?lang=en`).title);
  });
});

describe("production HTTP search routes", () => {
  let server: Server;
  let base: string;
  let directory: string;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "vedic-seo-"));
    fs.writeFileSync(path.join(directory, "index.html"), template);
    fs.writeFileSync(path.join(directory, "asset.js"), "console.log('public asset');");
    const app = express();
    app.use(searchIndexingHeaders);
    registerSearchRoutes(app);
    app.get("/api/example", (_req, res) => res.json({ ok: true }));
    serveStatic(app, directory);
    server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  it("serves plain robots, XML sitemap and localized HTML rather than an SPA fallback", async () => {
    for (const [url, type, text] of [["/robots.txt", "text/plain", "Sitemap:"], ["/sitemap.xml", "application/xml", "<urlset"], ["/?lang=ru", "text/html", seoCopy.ru.heading]]) {
      const response = await fetch(base + url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(type);
      expect(await response.text()).toContain(text);
    }
  });
  it("adds noindex to APIs, private HTML and HEAD responses; assets still work", async () => {
    for (const url of ["/api/example", "/pay/test", "/status/test", "/owner-login", "/admin"]) {
      const response = await fetch(base + url, { method: "HEAD" });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    }
    expect((await fetch(base + "/asset.js")).status).toBe(200);
    expect((await fetch(base + "/")).headers.get("x-robots-tag")).toBeNull();
  });
  it("returns real 404s and redirects raw index.html to its canonical route", async () => {
    const missing = await fetch(base + "/nonexistent-landing");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-robots-tag")).toContain("noindex");
    const index = await fetch(base + "/index.html", { redirect: "manual" });
    expect(index.status).toBe(301);
    expect(index.headers.get("location")).toBe("/");
  });
});
