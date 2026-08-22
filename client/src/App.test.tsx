// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./pages/Home", () => ({ default: () => <div>Jyotish · by Anika</div> }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
import App from "./App";

describe("App route loading", () => {
  afterEach(() => cleanup());

  it("renders the public Home route without eagerly rendering the Admin page", () => {
    window.history.replaceState({}, "", "/");
    render(<App />);
    expect(screen.getByText("Jyotish · by Anika")).toBeInTheDocument();
    expect(screen.queryByText("Booking overview")).not.toBeInTheDocument();
  });
});
