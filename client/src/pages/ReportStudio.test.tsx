// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    reportStudio: {
      queue: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      processingSettings: { useQuery: () => ({ data: { autoProcessEnabled: false }, refetch: vi.fn() }) },
      updateProcessingSettings: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      getJob: { useQuery: () => ({ data: undefined, refetch: vi.fn() }) },
      runCalculation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      approve: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      retryDelivery: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ reportStudio: { queue: { invalidate: vi.fn() } } }),
  },
}));

import ReportStudio from "./ReportStudio";

describe("Report Studio review screen", () => {
  afterEach(() => cleanup());

  it("explains the verified-payment queue and owner approval gate", () => {
    render(<ReportStudio />);
    expect(screen.getByText("Review & approve reports")).toBeInTheDocument();
    expect(screen.getByText("Report queue")).toBeInTheDocument();
    expect(screen.getByText("No paid report jobs yet.")).toBeInTheDocument();
    expect(screen.getByText(/approve it before any client delivery/i)).toBeInTheDocument();
  });
});
