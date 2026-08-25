// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminMetrics from "./AdminMetrics";

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { slaSettings: { invalidate: vi.fn() } } }),
    admin: {
      metrics: { useQuery: () => ({ data: { bookings: 1, paidBookings: 1, queuedReports: 0, openAlerts: 0, completedBookings: 1, sentReports: 1, failedDeliveries: 0, since: "2026-08-01T00:00:00.000Z", recentAlerts: [] }, isLoading: false, refetch: vi.fn() }) },
      slaEvaluationRuns: { useQuery: () => ({ data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }, isLoading: false, refetch: vi.fn() }) },
      slaSettings: { useQuery: () => ({ data: { enabled: true, preparationHours: 48, deliveryHours: 24, alertCooldownMinutes: 60 }, isLoading: false }) },
      updateSlaSettings: { useMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }) },
      evaluateSla: { useMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }) },
      exportMetricsCsv: { useMutation: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false }) },
    },
  },
}));

describe("AdminMetrics localization", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("persists the metrics dashboard dark theme and exposes journal search", () => {
    render(<AdminMetrics />);
    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(screen.getByRole("textbox", { name: "Run ID, error code, status…" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Window (days)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "CSV" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Error type" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rows" })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(localStorage.getItem("admin-metrics-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("persists the journal view mode and PNG background preference", () => {
    localStorage.setItem("admin-sla-journal-mode", "infinite");
    localStorage.setItem("admin-sla-png-background", "dark");
    render(<AdminMetrics />);
    expect(screen.getByRole("combobox", { name: "Journal view" })).toHaveTextContent("Infinite scroll");
    expect(screen.getByRole("combobox", { name: "PNG background" })).toHaveTextContent("Dark");
  });

  it("restores the owner language from localStorage", () => {
    localStorage.setItem("admin-locale", "es");
    render(<AdminMetrics />);
    expect(screen.getByRole("heading", { name: "Métricas de uso y SLA" })).toBeInTheDocument();
    expect(screen.getByText("Idioma del panel admin")).toBeInTheDocument();
  });
});
