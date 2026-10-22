// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import PageMetadata from "./PageMetadata";
import { seoCopy } from "@shared/seo";

afterEach(() => { cleanup(); document.head.innerHTML = ""; });
describe("metadata on public and private client navigation", () => {
  it("updates language, canonical and structured data when the language URL changes", () => {
    window.history.replaceState({}, "", "/?lang=ru&utm_source=test");
    render(<PageMetadata />);
    expect(document.title).toBe(seoCopy.ru.title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://karmalifedesign.com/?lang=ru");
    act(() => { window.history.replaceState({}, "", "/?lang=de"); window.dispatchEvent(new CustomEvent("public-locale-changed", { detail: "de" })); });
    expect(document.title).toBe(seoCopy.de.title);
    expect(document.documentElement.lang).toBe("de");
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(document.querySelector('script[type="application/ld+json"]')?.textContent).toContain(seoCopy.de.heading);
  });
  it("removes public preview data when navigating to a private order", () => {
    window.history.replaceState({}, "", "/?lang=ru");
    render(<PageMetadata />);
    act(() => { window.history.pushState({}, "", "/status/secret-order-link"); });
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex");
    expect(document.querySelector('link[rel="canonical"], meta[property="og:url"], script[type="application/ld+json"]')).toBeNull();
    expect(document.head.innerHTML).not.toContain("secret-order-link");
  });
});
