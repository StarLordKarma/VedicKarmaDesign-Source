// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "./Admin";

const updateMutate = vi.fn();
const exportCsvMutate = vi.fn();
const exportPdfMutate = vi.fn();
const attachMutateAsync = vi.fn().mockResolvedValue(undefined);
const options: Array<{ onSuccess?: (result: { contentBase64: string; filename: string }) => void; onError?: () => void }> = [];
const row = { id: 1, name: "Maya", email: "maya@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: 0, totalUsd: 25, paymentStatus: "finished", status: "new", adminNote: null, createdAt: new Date("2026-01-01T00:00:00Z"), natalPdfUrl: null, natalPdfName: null };
const queryData = [row];

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" }, loading: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { bookingList: { invalidate: vi.fn() } } }),
    admin: {
      bookingList: { useQuery: () => ({ data: queryData, isLoading: false, error: null }) },
      updateBooking: { useMutation: () => ({ mutate: updateMutate, isPending: false, isSuccess: false }) },
      exportCsv: { useMutation: (config: typeof options[number]) => { options[0] = config; return { mutate: exportCsvMutate, isPending: false }; } },
      exportPdf: { useMutation: (config: typeof options[number]) => { options[1] = config; return { mutate: exportPdfMutate, isPending: false }; } },
      attachNatalPdf: { useMutation: (config: typeof options[number]) => { options[2] = config; return { mutateAsync: attachMutateAsync, isPending: false }; } },
    },
  },
}));

describe("Admin interactions", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    options.length = 0;
    updateMutate.mockReset();
    exportCsvMutate.mockReset();
    exportPdfMutate.mockReset();
    attachMutateAsync.mockClear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("toggles RU/EN labels and persists admin-locale", () => {
    render(<Admin />);
    expect(screen.getByRole("heading", { name: "Booking overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /LANGUAGE: RU/i }));
    expect(screen.getByRole("heading", { name: "Обзор заявок" })).toBeInTheDocument();
    expect(localStorage.getItem("admin-locale")).toBe("ru");
  });

  it("invokes both export mutations and handles blob downloads", () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(exportCsvMutate).toHaveBeenCalledOnce();
    expect(exportPdfMutate).toHaveBeenCalledOnce();
    act(() => {
      options[0].onSuccess?.({ contentBase64: "Y29udGVudA==", filename: "bookings.csv" });
      options[1].onSuccess?.({ contentBase64: "JVBERi0x", filename: "bookings.pdf" });
    });
    expect(anchorClick).toHaveBeenCalledTimes(2);
  });

  it("shows Russian success feedback after switching locale and completing PDF upload", async () => {
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: /LANGUAGE: RU/i }));
    const input = screen.getByLabelText("Прикрепить PDF натальной карты") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF-1.7"], "chart.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(attachMutateAsync).toHaveBeenCalledOnce());
    act(() => options[2].onSuccess?.({ contentBase64: "", filename: "" }));
    expect(screen.getByRole("status")).toHaveTextContent("PDF прикреплён.");
  });

  it("accepts valid PDF upload and shows invalid/oversized feedback", async () => {
    render(<Admin />);
    const input = screen.getByLabelText("Attach natal chart PDF") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF-1.7"], "chart.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(attachMutateAsync).toHaveBeenCalledOnce());
    act(() => options[2].onSuccess?.({ contentBase64: "", filename: "" }));
    expect(screen.getByRole("status")).toHaveTextContent("PDF attached.");

    fireEvent.change(input, { target: { files: [new File(["bad"], "chart.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("status")).toHaveTextContent("Choose a PDF file.");

    const oversized = new File([new Uint8Array(1)], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: 12 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole("status")).toHaveTextContent("12 MB or smaller");
  });
});
