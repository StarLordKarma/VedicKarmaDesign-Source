// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ queue: [] as unknown[], detail: undefined as unknown, createTestJob: vi.fn(), deleteTestJob: vi.fn() }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    reportStudio: {
      queue: { useQuery: () => ({ data: state.queue, isLoading: false, error: null }) },
      processingSettings: { useQuery: () => ({ data: { autoProcessEnabled: false }, refetch: vi.fn() }) },
      updateProcessingSettings: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      getJob: { useQuery: () => ({ data: state.detail, refetch: vi.fn() }) },
      createTestJob: { useMutation: () => ({ mutate: state.createTestJob, isPending: false }) },
      deleteTestJob: { useMutation: () => ({ mutate: state.deleteTestJob, isPending: false }) },
      runCalculation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      approve: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      retryDelivery: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      reviseNarrative: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ reportStudio: { queue: { invalidate: vi.fn() } } }),
  },
}));

import ReportStudio from "./ReportStudio";

describe("Report Studio review screen", () => {
  afterEach(() => cleanup());
  beforeEach(() => { state.queue = []; state.detail = undefined; state.createTestJob.mockReset(); state.deleteTestJob.mockReset(); });

  it("explains the verified-payment queue and owner approval gate", () => {
    render(<ReportStudio />);
    expect(screen.getByText("Review & approve reports")).toBeInTheDocument();
    expect(screen.getByText("Report queue")).toBeInTheDocument();
    expect(screen.getByText(/No paid report jobs yet/i)).toBeInTheDocument();
    expect(screen.getByText(/approve it before any client delivery/i)).toBeInTheDocument();
  });

  it("offers open and download actions for an owner-reviewed generated PDF", () => {
    state.queue = [{ job: { id: 7, bookingId: 17, packageType: "basic", language: "English", attemptCount: 1, status: "needs_review", lastErrorMessage: null }, version: { status: "needs_review" } }];
    state.detail = { job: { id: 7, status: "needs_review" }, booking: { name: "Maya", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany" }, versions: [{ id: 9, versionNumber: 1, status: "needs_review", pdfStorageKey: "report-studio/7/v1-preview.pdf" }], calculation: { validationStatus: "valid" }, narrative: null };
    render(<ReportStudio />);
    fireEvent.click(screen.getByRole("button", { name: /booking #17/i }));
    expect(screen.getByRole("link", { name: "Open PDF" })).toHaveAttribute("href", "/manus-storage/report-studio/7/v1-preview.pdf");
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute("download");
    expect(screen.getByRole("button", { name: "Approve PDF for delivery" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Approve PDF for delivery" })).toBeEnabled();
  });

  it("creates a clearly synthetic owner-only test job without a client delivery action", () => {
    render(<ReportStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Create test job" }));
    expect(state.createTestJob).toHaveBeenCalledWith({ packageType: "basic", language: "en" });
    expect(screen.getAllByText(/Synthetic test/i).length).toBeGreaterThan(0);
  });
});
