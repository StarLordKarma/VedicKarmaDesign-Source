import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { renderPage } from "../reading-core/site.mjs";
import { SITE } from "../reading-core/locales/site-copy.mjs";

const script = readFileSync("reading-core/app.mjs", "utf8").replace(/^import .*;$/gm, "");
it.each(["sample-western", "sample-tarot", "offers-vedic", "western", "tarot"])("opens the correct visible product for a direct #%s marketing link", hash => {
  const dom = new JSDOM(renderPage("de"), { url: `https://karmalifedesign.com/?lang=de#${hash}`, runScripts: "outside-only" });
  const window = dom.window as any;
  window.SITE = SITE;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.eval(script);
  const kind = hash.split("-").at(-1)!;
  expect(window.document.body.dataset.mode).toBe(kind);
  expect(window.document.getElementById(kind).hidden).toBe(false);
  expect(window.document.getElementById(`tab-${kind}`).getAttribute("aria-selected")).toBe("true");
  for (const other of ["vedic", "western", "tarot"].filter(name => name !== kind)) expect(window.document.getElementById(other).hidden).toBe(true);
  dom.window.close();
});
