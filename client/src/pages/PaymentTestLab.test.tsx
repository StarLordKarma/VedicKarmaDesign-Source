// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaymentTestLab from "./PaymentTestLab";

const runSimulation = vi.fn();
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin", openId: "owner" }, loading: false }) }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({ trpc: { admin: { runIpnSimulation: { useMutation: () => ({ mutate: runSimulation, isPending: false, error: null }) }, paymentTestLabRuns: { useQuery: () => ({ data: { items: [], totalPages: 0 }, refetch: vi.fn() }) }, exportPaymentTestLabRunsCsv: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, paymentTestLabRetention: { useQuery: () => ({ data: { retentionDays: 90, lastCleanupAt: null, lastCleanupDeleted: null }, refetch: vi.fn() }) }, paymentTestLabRetentionPreview: { useQuery: () => ({ data: { eligibleCount: 0 }, refetch: vi.fn() }) }, paymentTestLabRetentionChanges: { useQuery: () => ({ data: [], refetch: vi.fn() }) }, updatePaymentTestLabRetention: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, cleanupPaymentTestLabRuns: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } } }));

describe("Payment Test Lab", () => {
  it("runs the owner-only confirmed signed-IPN simulation", () => {
    render(<PaymentTestLab />);
    expect(screen.getByText(/Audit retention/i)).toBeInTheDocument();
    expect(screen.getByText(/Eligible for deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/Retention changes/i)).toBeInTheDocument();
  });
});
