// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VisitorPrivacyChoices from "./VisitorPrivacyChoices";

describe("Visitor privacy choices", () => {
  afterEach(() => { localStorage.clear(); document.head.querySelector('[data-consent-analytics="true"]')?.remove(); });
  it("keeps optional analytics off until the visitor explicitly opts in", () => {
    render(<VisitorPrivacyChoices />);
    expect(screen.getByRole("button", { name: "Allow optional analytics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue without analytics" }));
    expect(localStorage.getItem("visitor-privacy-choice-v1")).toBe("necessary");
    expect(document.head.querySelector('[data-consent-analytics="true"]')).toBeNull();
  });
});
