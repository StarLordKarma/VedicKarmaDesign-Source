// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServicePackages from "./ServicePackages";

const mutationState = { isPending: false, mutate: vi.fn() };
const createMutationState = { isPending: false, mutate: vi.fn() };
const editMutationState = { isPending: false, mutate: vi.fn() };
let mutationOptions: { onSuccess?: () => void; onError?: (error: Error) => void } = {};

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin", openId: "owner-open-id" }, loading: false }) }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/trpc", () => ({ trpc: { admin: { servicePackages: { useQuery: () => ({ data: [{ id: 1, code: "basic", packageType: "basic", version: 1, nameEn: "Basic reading", nameRu: "Базовое чтение", nameDe: "Basisdeutung", nameEs: "Lectura básica", active: true }, { id: 2, code: "basic_plus", packageType: "basic_plus", version: 1, nameEn: "Basic + numerology", nameRu: "Базовое + нумерология", nameDe: "Basisdeutung + Numerologie", nameEs: "Básica + numerología", active: true }], isLoading: false, error: null }) }, updateServicePackageActive: { useMutation: (options: typeof mutationOptions) => { mutationOptions = options; return mutationState; } }, createServicePackageVersion: { useMutation: () => createMutationState }, updateServicePackageVersion: { useMutation: () => editMutationState } }, pricing: { packages: { invalidate: vi.fn() } }, useUtils: () => ({ admin: { servicePackages: { invalidate: vi.fn() } }, pricing: { packages: { invalidate: vi.fn() } } }) } }));

describe("ServicePackages", () => {
  afterEach(() => { cleanup(); mutationState.mutate.mockReset(); createMutationState.mutate.mockReset(); editMutationState.mutate.mockReset(); window.localStorage.clear(); });

  it("shows the owner package catalog and confirms a deactivate action", () => {
    render(<ServicePackages />);
    expect(screen.getByRole("heading", { name: "Service package versions" })).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);
    expect(screen.getByRole("heading", { name: "Confirm package change" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mutationState.mutate).toHaveBeenCalledWith({ code: "basic", version: 1, active: false });
  });

  it("creates a localized next package version without overwriting the existing version", () => {
    render(<ServicePackages />);
    fireEvent.click(screen.getByRole("button", { name: "Create version" }));
    expect(screen.getByRole("heading", { name: "Create package version" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name (English)"), { target: { value: "Basic reading revised" } });
    fireEvent.change(screen.getByLabelText("Name (Russian)"), { target: { value: "Базовое чтение 2" } });
    fireEvent.change(screen.getByLabelText("Name (German)"), { target: { value: "Basisdeutung 2" } });
    fireEvent.change(screen.getByLabelText("Name (Spanish)"), { target: { value: "Lectura básica 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    expect(createMutationState.mutate).toHaveBeenCalledWith({ packageType: "basic", nameEn: "Basic reading revised", nameRu: "Базовое чтение 2", nameDe: "Basisdeutung 2", nameEs: "Lectura básica 2", active: true });
  });
});
