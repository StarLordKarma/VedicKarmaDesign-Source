// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resolveLocale } from "./Home";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mutationState = { isPending: false, mutate: vi.fn() };
let mutationOptions: { onSuccess?: (result: { invoiceUrl: string }) => void } = {};
const pricingData = { basicUsd: 25, numerologyAddonUsd: 10 };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    pricing: { current: { useQuery: () => ({ data: pricingData }) } },
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
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    mutationState.isPending = false;
    mutationState.mutate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the current configured prices from the public pricing query", () => {
    pricingData.basicUsd = 40;
    pricingData.numerologyAddonUsd = 15;
    render(<Home />);
    expect(screen.getAllByText("$40").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getAllByText("$55").length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "EUR" } });
    expect(screen.getAllByText("€40").length).toBeGreaterThan(0);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "GBP" } });
    expect(screen.getAllByText("£40").length).toBeGreaterThan(0);
    pricingData.basicUsd = 25;
    pricingData.numerologyAddonUsd = 10;
  });

  it("persists the selected German language and resolves it on a later session", () => {
    const view = render(<Home />);
    const selector = screen.getAllByRole("combobox", { name: "Language" })[0];
    fireEvent.change(selector, { target: { value: "de" } });
    expect(localStorage.getItem("public-locale")).toBe("de");
    expect(screen.getByText("Eine klarere Karte für Ihren inneren Himmel.")).toBeInTheDocument();
    cleanup();
    expect(resolveLocale(localStorage.getItem("public-locale"))).toBe("de");
    view.unmount();
  });

  it("shows pending loading, success confirmation, and schedules the checkout redirect", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    const view = render(<Home />);

    mutationState.isPending = true;
    view.rerender(<Home />);
    expect(screen.getByRole("button", { name: /Creating your secure checkout/i })).toBeInTheDocument();

    mutationState.isPending = false;
    view.rerender(<Home />);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Currency" })[0], { target: { value: "EUR" } });
    expect(screen.getAllByText((_, node) => Boolean(node?.textContent?.includes("25") && node.textContent.includes("€"))).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Preferred name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "maya@example.com" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-04-12" } });
    fireEvent.change(screen.getByLabelText("Exact time of birth"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("City of birth"), { target: { value: "Delhi" } });
    fireEvent.change(screen.getByLabelText("Country of birth"), { target: { value: "India" } });
    fireEvent.click(screen.getByRole("button", { name: /Request my reading/i }));
    expect(mutationState.mutate).toHaveBeenCalledOnce();

    await act(async () => {
      mutationOptions.onSuccess?.({ invoiceUrl: "https://checkout.example/invoice/1" });
    });
    expect(screen.getByText("Your request is received.")).toBeInTheDocument();
    expect(screen.getByText(/Your request is saved/)).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => Boolean(node?.textContent?.includes("25") && node.textContent.includes("€"))).length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(assign).toHaveBeenCalledWith("https://checkout.example/invoice/1");
  });
});
