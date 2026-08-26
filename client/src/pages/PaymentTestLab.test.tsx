// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaymentTestLab from "./PaymentTestLab";

const runSimulation = vi.fn();
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin", openId: "owner" }, loading: false }) }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({ trpc: { admin: { runIpnSimulation: { useMutation: () => ({ mutate: runSimulation, isPending: false, error: null }) } } } }));

describe("Payment Test Lab", () => {
  it("runs the owner-only confirmed signed-IPN simulation", () => {
    render(<PaymentTestLab />);
    fireEvent.click(screen.getByRole("button", { name: "Run signed confirmation test" }));
    expect(runSimulation).toHaveBeenCalledWith({ paymentStatus: "confirmed" });
    expect(screen.getByText(/cryptocurrency transfers are suppressed/i)).toBeInTheDocument();
  });
});
