import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { JSDOM } from "jsdom";
import { GUIDE_PATHS, readingGuides } from "../shared/reading-guides";
import { publicPageUrl, SEO_LOCALES } from "../shared/seo";
import { registerReadingGuides } from "./reading-guides";
import { sitemapXml } from "./_core/seo";

describe("public reading guides", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    registerReadingGuides(app);
    server = await new Promise<Server>(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  it.each(SEO_LOCALES)("serves complete localized articles without JavaScript for %s", async locale => {
    for (const [index, path] of GUIDE_PATHS.entries()) {
      const response = await fetch(`${base}${path}?lang=${locale}&utm_source=forum&email=private%40example.com`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-language")).toBe(locale);
      const html = await response.text();
      const document = new JSDOM(html).window.document;
      expect(document.querySelector("h1")?.textContent).toBe(readingGuides[locale][index].title);
      expect(document.querySelectorAll("article p").length).toBeGreaterThanOrEqual(5);
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(publicPageUrl(path, locale));
      expect(document.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(5);
      expect(document.querySelector("article a")?.getAttribute("href")).toContain(`#sample-${readingGuides[locale][index].view}`);
      expect(html).not.toMatch(/private%40|utm_source/);
      expect(Array.from(document.querySelectorAll("script[src]"), node => node.getAttribute("src"))).toEqual(["/readings/guide-audience.mjs"]);
      expect(sitemapXml()).toContain(publicPageUrl(path, locale).replaceAll("&", "&amp;"));
    }
  });
  it("does not turn an unknown guide into a valid public page or reflect an invalid language", async () => {
    expect((await fetch(`${base}/guides/nonexistent`)).status).toBe(404);
    const response = await fetch(`${base}${GUIDE_PATHS[0]}?lang=%3Cscript%3E`);
    const document = new JSDOM(await response.text()).window.document;
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(publicPageUrl(GUIDE_PATHS[0], "en"));
  });
});
