// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it,vi } from "vitest";
import VisitorPrivacyChoices from "./VisitorPrivacyChoices";

describe("Visitor privacy choices", () => {
  afterEach(() => { localStorage.clear(); document.head.querySelector('[data-consent-analytics="true"]')?.remove();window.history.replaceState(null,'','/');vi.unstubAllEnvs(); });
  it('does not load configured optional analytics on owner pages even with prior consent',()=>{
    vi.stubEnv('VITE_ANALYTICS_ENDPOINT','https://analytics.example.org');vi.stubEnv('VITE_ANALYTICS_WEBSITE_ID','synthetic');
    window.history.replaceState(null,'','/admin/control');localStorage.setItem('visitor-privacy-choice-v1','analytics');
    const view=render(<VisitorPrivacyChoices/>);expect(view.container).toBeEmptyDOMElement();expect(document.head.querySelector('[data-consent-analytics="true"]')).toBeNull();
  });
  it("keeps optional analytics off until the visitor explicitly opts in", () => {
    render(<VisitorPrivacyChoices />);
    expect(screen.getByRole("button", { name: "Allow optional analytics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue without analytics" }));
    expect(localStorage.getItem("visitor-privacy-choice-v1")).toBe("necessary");
    expect(document.head.querySelector('[data-consent-analytics="true"]')).toBeNull();
  });
});
