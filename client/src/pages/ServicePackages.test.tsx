// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServicePackages from "./ServicePackages";

const mutationState = { isPending: false, mutate: vi.fn() };
let mutationOptions: { onSuccess?: () => void; onError?: (error: Error) => void } = {};

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin", openId: "owner-open-id" }, loading: false }) }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({ trpc: { admin: { servicePackages: { useQuery: () => ({ data: [{ id: 1, code: "basic", version: 1, nameEn: "Basic reading", nameRu: "Базовое чтение", nameDe: "Basisdeutung", nameEs: "Lectura básica", active: true }, { id: 2, code: "basic_plus", version: 1, nameEn: "Basic + numerology", nameRu: "Базовое + нумерология", nameDe: "Basisdeutung + Numerologie", nameEs: "Básica + numerología", active: true }], isLoading: false, error: null }) }, updateServicePackageActive: { useMutation: (options: typeof mutationOptions) => { mutationOptions = options; return mutationState; } } }, pricing: { packages: { invalidate: vi.fn() } }, useUtils: () => ({ admin: { servicePackages: { invalidate: vi.fn() } }, pricing: { packages: { invalidate: vi.fn() } } }) } }));

describe("ServicePackages", () => {
  afterEach(() => { cleanup(); mutationState.mutate.mockReset(); window.localStorage.clear(); });

  it("shows the owner package catalog and confirms a deactivate action", () => {
    render(<ServicePackages />);
    expect(screen.getByRole("heading", { name: "Active service packages" })).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);
    expect(screen.getByRole("heading", { name: "Confirm package change" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mutationState.mutate).toHaveBeenCalledWith({ code: "basic", version: 1, active: false });
  });
});
