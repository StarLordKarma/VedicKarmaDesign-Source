// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resolveLocale } from "./Home";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mutationState = { isPending: false, mutate: vi.fn() };
const pdfMutationState = { isPending: false, mutate: vi.fn() };
const emailMutationState = { isPending: false, mutate: vi.fn() };
const promoMutationState = { isPending: false, mutate: vi.fn() };
let mutationOptions: { onSuccess?: (result: { invoiceUrl: string }) => void } = {};
let pdfMutationOptions: { onSuccess?: (result: { filename: string; contentBase64: string; url: string }) => void; onError?: (error: Error) => void } = {};
let emailMutationOptions: { onSuccess?: () => void; onError?: () => void } = {};
let promoMutationOptions: { onSuccess?: (result: { valid: boolean; code: string; discountPercent: number; discountAmount: number; totalAmount: number }) => void; onError?: () => void } = {};
const pricingData = { basicUsd: 25, numerologyAddonUsd: 10 };
let packageData: Array<{ code: "basic" | "basic_plus" }> = [{ code: "basic" }, { code: "basic_plus" }];
const renderHome = () => render(<ThemeProvider switchable><Home /></ThemeProvider>);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    pricing: { current: { useQuery: () => ({ data: pricingData }) }, packages: { useQuery: () => ({ data: packageData }) }, validatePromo: { useMutation: (options: typeof promoMutationOptions) => { promoMutationOptions = options; return promoMutationState; } }, breakdownPdf: { useMutation: (options: typeof pdfMutationOptions) => { pdfMutationOptions = options; return pdfMutationState; } }, emailBreakdownPdf: { useMutation: (options: typeof emailMutationOptions) => { emailMutationOptions = options; return emailMutationState; } } },
    booking: {
      submit: {
        useMutation: (options: typeof mutationOptions) => {
          mutationOptions = options;
          return mutationState;
        },
      },
    },
  },
}));

describe("Home booking payment UX", () => {
  it("does not expose a customer file attachment input", () => {
    renderHome();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("disables an inactive package and selects the remaining active package", () => {
    packageData = [{ code: "basic_plus" }];
    renderHome();
    expect(screen.getByRole("radio", { name: "Basic reading" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Basic + numerology" })).toBeChecked();
  });

  it("autosaves safe form values, restores a recent draft, and never restores consent", () => {
    renderHome();
    fireEvent.input(screen.getByLabelText("Preferred name"), { target: { value: "Maya" } });
    expect(JSON.parse(localStorage.getItem("vedic-booking-draft-v1") ?? "{}")).toMatchObject({ name: "Maya", addon: false, currency: "USD" });
    expect(screen.getByTestId("draft-status")).toHaveTextContent("Draft saved locally");
    expect(screen.getByTestId("draft-relative-time")).toHaveTextContent("Saved just now");

    cleanup();
    renderHome();
    expect(screen.getByLabelText("Preferred name")).toHaveValue("Maya");
    expect(screen.getByTestId("draft-status")).toHaveTextContent("Draft restored from this device");
    expect(screen.getByLabelText("privacy consent")).not.toBeChecked();
  });

  it("clears the draft and resets the form in one action", () => {
    renderHome();
    const name = screen.getByLabelText("Preferred name");
    fireEvent.input(name, { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    expect(name).toHaveValue("");
    expect(localStorage.getItem("vedic-booking-draft-v1")).toBeNull();
    expect(screen.queryByTestId("draft-status")).not.toBeInTheDocument();
  });

  it("removes a draft older than the retention window", () => {
    localStorage.setItem("vedic-booking-draft-v1", JSON.stringify({ savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, currency: "USD", name: "Old" }));
    renderHome();
    expect(localStorage.getItem("vedic-booking-draft-v1")).toBeNull();
    expect(screen.getByLabelText("Preferred name")).toHaveValue("");
  });

  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    packageData = [{ code: "basic" }, { code: "basic_plus" }];
    window.history.replaceState({}, "", "/");
    vi.useFakeTimers();
    mutationState.isPending = false;
    mutationState.mutate.mockReset();
    pdfMutationState.isPending = false;
    pdfMutationState.mutate.mockReset();
    emailMutationState.isPending = false;
    emailMutationState.mutate.mockReset();
    promoMutationState.isPending = false;
    promoMutationState.mutate.mockReset();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the current configured prices from the public pricing query", () => {
    pricingData.basicUsd = 40;
    pricingData.numerologyAddonUsd = 15;
    renderHome();
    expect(screen.getAllByText("$40").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("radio", { name: "Basic + numerology" }));
    expect(screen.getAllByText("$55").length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "EUR" } });
    expect(screen.getAllByText("€40").length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "GBP" } });
    expect(screen.getAllByText("£40").length).toBeGreaterThan(0);
    pricingData.basicUsd = 25;
    pricingData.numerologyAddonUsd = 10;
  });

  it("validates a promo code and updates the live total and included services", () => {
    renderHome();
    expect(screen.getByText("One clarification round")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Basic + numerology" }));
    expect(screen.getByText("Indian numerology overview")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Promo code"), { target: { value: "WELCOME10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(promoMutationState.mutate).toHaveBeenCalledWith({ currency: "USD", addon: true, promoCode: "WELCOME10" });
    act(() => promoMutationOptions.onSuccess?.({ valid: true, code: "WELCOME10", discountPercent: 10, discountAmount: 3.5, totalAmount: 31.5 }));
    expect(screen.getByTestId("live-total-breakdown")).toHaveTextContent("$32");
    expect(screen.getByTestId("applied-promo-status")).toHaveTextContent("Promo code applied");
  });

  it("shows a detailed checkout price breakdown and keeps the total mathematically consistent", () => {
    pricingData.basicUsd = 25;
    pricingData.numerologyAddonUsd = 10;
    renderHome();
    expect(screen.getByRole("group", { name: "Price breakdown" })).toHaveTextContent("Basic reading");
    expect(screen.getByRole("group", { name: "Price breakdown" })).toHaveTextContent("$25");
    expect(screen.getByRole("group", { name: "Price breakdown" })).toHaveTextContent("Not selected");
    expect(screen.getByRole("group", { name: "Price breakdown" })).toHaveTextContent("$0");
    expect(screen.getByRole("group", { name: "Price breakdown" })).toHaveTextContent("$25");
    fireEvent.click(screen.getByRole("radio", { name: "Basic + numerology" }));
    const breakdown = screen.getByRole("group", { name: "Price breakdown" });
    expect(breakdown).toHaveTextContent("Indian numerology add-on");
    expect(breakdown).toHaveTextContent("+$10");
    expect(breakdown).toHaveTextContent("$35");
  });

  it("updates the dedicated total breakdown when the package changes", () => {
    renderHome();
    const total = screen.getByTestId("live-total-breakdown");
    expect(total).toHaveTextContent("Total");
    expect(total).toHaveTextContent("$25");
    expect(screen.getByRole("radio", { name: "Basic + numerology" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Basic + numerology" }));
    expect(total).toHaveTextContent("+$10");
    expect(total).toHaveTextContent("$35");
  });

  it("keeps price-breakdown tooltip copy aligned with the selected language", () => {
    renderHome();
    expect(screen.getByRole("button", { name: "Basic reading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Indian numerology add-on/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Total" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("combobox", { name: "Language" })[0], { target: { value: "ru" } });
    expect(screen.getByRole("button", { name: "Базовое чтение" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Дополнение: индийская нумерология/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Итого" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("combobox", { name: "Язык" })[0], { target: { value: "de" } });
    expect(screen.getByRole("button", { name: "Basisdeutung" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zusatz: indische Numerologie/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gesamtsumme" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole("combobox", { name: "Sprache" })[0], { target: { value: "es" } });
    expect(screen.getByRole("button", { name: "Lectura básica" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Complemento de numerología india/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Total" })).toBeInTheDocument();
  });

  it("offers localized birth-field help, downloads the PDF, and shares its receipt link", async () => {
    renderHome();
    expect(screen.getByRole("button", { name: "Date of birth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exact time of birth" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download price breakdown PDF" }));
    expect(pdfMutationState.mutate).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", locale: "en", addon: false, labels: expect.objectContaining({ title: "Price breakdown", basic: "Basic reading", total: "Total", disclaimer: expect.stringContaining("personal reflection") }) }));
    act(() => { pdfMutationOptions.onSuccess?.({ filename: "price.pdf", contentBase64: btoa("%PDF-1.7"), url: "/manus-storage/price-breakdowns/test.pdf" }); });
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("http://localhost:3000/manus-storage/price-breakdowns/test.pdf")));
    expect(screen.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("http://localhost:3000/manus-storage/price-breakdowns/test.pdf")));
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Share on device" })); });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Share receipt", files: expect.arrayContaining([expect.any(File)]) }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy receipt link" })); });
    expect(screen.getByRole("button", { name: "Receipt link copied" })).toBeInTheDocument();
  });

  it("persists the selected German language and resolves it on a later session", () => {
    const view = renderHome();
    const selector = screen.getAllByRole("combobox")[0];
    fireEvent.change(selector, { target: { value: "de" } });
    expect(localStorage.getItem("public-locale")).toBe("de");
    expect(screen.getByText("Eine klarere Karte für Ihren inneren Himmel.")).toBeInTheDocument();
    cleanup();
    expect(resolveLocale(localStorage.getItem("public-locale"))).toBe("de");
    view.unmount();
  });

  it("restores the saved language and theme for the booking form", () => {
    localStorage.setItem("public-locale", "es");
    localStorage.setItem("theme", "dark");
    renderHome();
    expect(screen.getByText("Un mapa más claro para tu cielo interior.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modo claro" })).toBeInTheDocument();
  });

  it("toggles the booking form theme and persists the new choice", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    expect(document.documentElement).toHaveClass("theme-transition");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("theme-transition");
  });

  it("highlights and shakes the consent block when submitting without acceptance", () => {
    renderHome();
    fireEvent.change(screen.getByLabelText("Preferred name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "maya@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-04-12" } });
    fireEvent.change(screen.getByLabelText("Exact time of birth"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("City of birth"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "India" } });

    fireEvent.click(screen.getByRole("button", { name: /Request my reading/i }));

    expect(mutationState.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please read and accept the privacy information before submitting.");
    expect(screen.getByLabelText("privacy consent")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("privacy consent").closest("label")).toHaveClass("consent-error-shake");

    fireEvent.click(screen.getByLabelText("privacy consent"));
    expect(screen.getByLabelText("privacy consent")).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Please read and accept the privacy information before submitting.")).not.toBeInTheDocument();
  });

  it("shows pending loading, success confirmation, and schedules the checkout redirect", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    const view = renderHome();
    expect(screen.getByRole("status", { name: "Booking progress" })).toHaveTextContent("2 steps remaining");
    expect(screen.getByText("Choose reading")).toBeInTheDocument();

    mutationState.isPending = true;
    view.rerender(<ThemeProvider switchable><Home /></ThemeProvider>);
    expect(screen.getByRole("button", { name: /Creating your secure checkout/i })).toBeInTheDocument();

    mutationState.isPending = false;
    view.rerender(<ThemeProvider switchable><Home /></ThemeProvider>);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "EUR" } });
    expect(screen.getAllByText((_, node) => Boolean(node?.textContent?.includes("25") && node.textContent.includes("€"))).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Preferred name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "maya@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-04-12" } });
    fireEvent.change(screen.getByLabelText("Exact time of birth"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("City of birth"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "India" } });
    fireEvent.click(screen.getByLabelText("privacy consent"));
    fireEvent.click(screen.getByRole("button", { name: /Request my reading/i }));
    expect(screen.getByRole("dialog", { name: "Review your order" })).toBeInTheDocument();
    expect(document.querySelector(".order-preview-backdrop")).toBeInTheDocument();
    expect(document.querySelector(".order-preview-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));
    expect(mutationState.mutate).toHaveBeenCalledOnce();

    await act(async () => {
      mutationOptions.onSuccess?.({ invoiceUrl: "https://checkout.example/invoice/1" });
    });
    expect(screen.getByText("Your request is received.")).toBeInTheDocument();
    expect(screen.getByText(/Your request is saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("wa.me"));
    expect(screen.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", expect.stringContaining("t.me/share"));
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute("href", expect.stringContaining("twitter.com/intent/tweet"));
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", expect.stringContaining("facebook.com/sharer"));
    expect(document.querySelector(".success-pop")).toBeInTheDocument();
    expect(document.querySelector(".success-checkmark")).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => Boolean(node?.textContent?.includes("25") && node.textContent.includes("€"))).length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(assign).toHaveBeenCalledWith("https://checkout.example/invoice/1");
  });

  it("emails the generated receipt from the checkout success state and surfaces delivery errors", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    renderHome();
    fireEvent.change(screen.getByLabelText("Preferred name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "maya@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-04-12" } });
    fireEvent.change(screen.getByLabelText("Exact time of birth"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("City of birth"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "India" } });
    fireEvent.click(screen.getByLabelText("privacy consent"));
    fireEvent.click(screen.getByRole("button", { name: /Request my reading/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));
    await act(async () => { mutationOptions.onSuccess?.({ invoiceUrl: "https://checkout.example/invoice/2" }); });

    const emailInput = screen.getByPlaceholderText("your@email.com");
    expect(emailInput).toHaveValue("maya@example.com");
    fireEvent.change(emailInput, { target: { value: "receipt@example.com" } });
    fireEvent.submit(emailInput.closest("form") as HTMLFormElement);
    expect(emailMutationState.mutate).toHaveBeenCalledWith(expect.objectContaining({ email: "receipt@example.com", currency: "USD", locale: "en", language: "English", labels: expect.objectContaining({ title: "Price breakdown", total: "Total" }) }));

    await act(async () => { emailMutationOptions.onSuccess?.(); });
    expect(screen.getByRole("status")).toHaveTextContent("Receipt sent by email.");
    expect(screen.getByRole("button", { name: "Email this receipt" })).toBeDisabled();
    expect(screen.getByText(/personal reflection and spiritual exploration/)).toBeInTheDocument();
    await act(async () => { emailMutationOptions.onError?.(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send the receipt. Please try again.");
  });
});
