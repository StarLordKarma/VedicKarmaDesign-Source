// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin, { draftStorageKey, getBulkDeliveryOutcome, matchesClientSearch, sortBookingRows } from "./Admin";

const { authState, startLoginMock } = vi.hoisted(() => ({ authState: { user: { role: "admin" } as { role: string } | null }, startLoginMock: vi.fn() }));
const updateMutate = vi.fn();
const exportCsvMutate = vi.fn();
const exportPdfMutate = vi.fn();
const sendPdfMutate = vi.fn();
const bulkSendPdfMutate = vi.fn();
const editClientMutate = vi.fn();
const attachMutateAsync = vi.fn().mockResolvedValue(undefined);
const options: Array<{ onSuccess?: (result: any) => void; onError?: () => void }> = [];
const row = { id: 1, name: "Maya", email: "maya@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: 0, totalUsd: 25, paymentStatus: "finished", status: "new", adminNote: null, createdAt: new Date("2026-01-01T00:00:00Z"), natalPdfUrl: null, natalPdfName: null };
const queryData = [row];
const historyData: Array<{ id: number; bookingId: number; changedBy: string; changedAt: Date; changes: string }> = [];

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: authState.user, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: startLoginMock }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { bookingList: { invalidate: vi.fn() } } }),
    admin: {
      bookingList: { useQuery: () => ({ data: queryData, isLoading: false, error: null }) },
      clientHistory: { useQuery: () => ({ data: historyData, isLoading: false, error: null }) },
      updateBooking: { useMutation: () => ({ mutate: updateMutate, isPending: false, isSuccess: false }) },
      exportCsv: { useMutation: (config: typeof options[number]) => { options[0] = config; return { mutate: exportCsvMutate, isPending: false }; } },
      exportPdf: { useMutation: (config: typeof options[number]) => { options[1] = config; return { mutate: exportPdfMutate, isPending: false }; } },
      sendNatalPdf: { useMutation: (config: typeof options[number]) => { options[3] = config; return { mutate: sendPdfMutate, isPending: false }; } },
      bulkSendNatalPdf: { useMutation: (config: { onSuccess?: (result: { sent: number; failed: number }) => void; onError?: () => void }) => { options[4] = config as typeof options[number]; return { mutate: bulkSendPdfMutate, isPending: false }; } },
      editBookingClient: { useMutation: (config: { onSuccess?: (result: typeof row) => void; onError?: () => void }) => { options[5] = config as typeof options[number]; return { mutate: editClientMutate, isPending: false }; } },
      attachNatalPdf: { useMutation: (config: typeof options[number]) => { options[2] = config; return { mutateAsync: attachMutateAsync, isPending: false }; } },
    },
  },
}));

describe("Admin interactions", () => {
  afterEach(() => { cleanup(); queryData.splice(1); Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0); });

  beforeEach(() => {
    queryData.splice(1);
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
    localStorage.clear();
    authState.user = { role: "admin" };
    startLoginMock.mockReset();
    options.length = 0;
    updateMutate.mockReset();
    exportCsvMutate.mockReset();
    exportPdfMutate.mockReset();
    sendPdfMutate.mockReset();
    bulkSendPdfMutate.mockReset();
    editClientMutate.mockReset();
    attachMutateAsync.mockClear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("shows an OAuth login action when the owner is not signed in", () => {
    authState.user = null;
    render(<Admin />);
    expect(screen.getByText("Admin access required")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in as owner" }));
    expect(startLoginMock).toHaveBeenCalledOnce();
  });

  it("toggles RU/EN labels and persists admin-locale", () => {
    render(<Admin />);
    expect(screen.getByRole("heading", { name: "Booking overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /LANGUAGE: RU/i }));
    expect(screen.getByRole("heading", { name: "Обзор заявок" })).toBeInTheDocument();
    expect(localStorage.getItem("admin-locale")).toBe("ru");
  });

  it("matches client name and email search and classifies bulk outcomes", () => {
    expect(matchesClientSearch({ id: 1, name: "Maya", email: "maya@example.com" }, "maya")).toBe(true);
    expect(matchesClientSearch({ id: 1, name: "Maya", email: "maya@example.com" }, "EXAMPLE.COM")).toBe(true);
    expect(matchesClientSearch({ id: 1, name: "Maya", email: "maya@example.com" }, "unknown")).toBe(false);
    expect(getBulkDeliveryOutcome(2, 0)).toBe("success");
    expect(getBulkDeliveryOutcome(1, 1)).toBe("partial");
    expect(getBulkDeliveryOutcome(0, 2)).toBe("failed");
  });

  it("sorts clients by registration date and status", () => {
    const records = [
      { id: 1, createdAt: "2026-01-01T00:00:00Z", status: "completed" },
      { id: 2, createdAt: "2026-02-01T00:00:00Z", status: "new" },
    ];
    expect(sortBookingRows(records, "date_desc").map((item) => item.id)).toEqual([2, 1]);
    expect(sortBookingRows(records, "status_asc").map((item) => item.id)).toEqual([1, 2]);
  });

  it("invokes both export mutations and handles blob downloads", () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Export client history CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(exportCsvMutate).toHaveBeenCalledOnce();
    expect(exportPdfMutate).toHaveBeenCalledOnce();
    act(() => {
      options[0].onSuccess?.({ contentBase64: "Y29udGVudA==", filename: "bookings.csv" });
      options[1].onSuccess?.({ contentBase64: "JVBERi0x", filename: "bookings.pdf" });
    });
    expect(anchorClick).toHaveBeenCalledTimes(2);
  });

  it("shows a visual badge for sent PDF delivery status", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent" });
    render(<Admin />);
    expect(screen.getByText("Sent to client")).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("invokes PDF delivery for a booking with an attached chart", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "not_sent" });
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Email PDF to client" }));
    expect(sendPdfMutate).toHaveBeenCalledWith({ bookingId: 1 });
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("paginates client history and navigates between pages", () => {
    queryData.push(...Array.from({ length: 10 }, (_, index) => ({ ...row, id: index + 2, name: `Client ${index + 2}`, createdAt: new Date(`2026-01-${String(index + 2).padStart(2, "0")}T00:00:00Z`) })));
    render(<Admin />);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Client 11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Maya")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    queryData.splice(1);
  });

  it("edits client details from the PDF preview modal", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent", interest: "Career" });
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya Updated" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "updated@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save client details" }));
    expect(editClientMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "Maya Updated", email: "updated@example.com" }));
  });

  it("opens the attached PDF in a preview dialog", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent" });
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(screen.getByTitle("Preview PDF: Maya")).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("shows distinct bulk delivery feedback for all, partial, and failed results", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "not_sent" });
    render(<Admin />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select client: Maya" }));
    fireEvent.click(screen.getByRole("button", { name: "Email selected PDFs" }));
    act(() => options[4].onSuccess?.({ sent: 1, failed: 0 }));
    expect(screen.getByRole("status")).toHaveTextContent("All selected PDFs were sent successfully.");
    act(() => options[4].onSuccess?.({ sent: 1, failed: 1 }));
    expect(screen.getByRole("status")).toHaveTextContent("Some PDFs were sent, but some deliveries failed.");
    act(() => options[4].onSuccess?.({ sent: 0, failed: 1 }));
    expect(screen.getByRole("status")).toHaveTextContent("No selected PDFs could be sent.");
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("selects clients with PDFs and invokes bulk delivery", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "not_sent" });
    render(<Admin />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select client: Maya" }));
    fireEvent.click(screen.getByRole("button", { name: "Email selected PDFs" }));
    expect(bulkSendPdfMutate).toHaveBeenCalledWith({ bookingIds: [1] });
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("filters client history by language and interest", () => {
    Object.assign(queryData[0], { language: "German", interest: "Career and relationships" });
    render(<Admin />);
    fireEvent.change(screen.getByRole("combobox", { name: "All languages" }), { target: { value: "German" } });
    expect(screen.getByText("Maya")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Interest contains" }), { target: { value: "health" } });
    expect(screen.getByText("No requests match this filter.")).toBeInTheDocument();
    Object.assign(queryData[0], { language: "English", interest: null });
  });

  it("shows a saved-draft badge and clears the draft from the modal", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent" });
    localStorage.setItem(draftStorageKey(1), JSON.stringify({ name: "Maya Draft" }));
    render(<Admin />);
    expect(screen.getByText("Unsaved draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(screen.getByDisplayValue("Maya Draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(localStorage.getItem(draftStorageKey(1))).toBeNull();
    expect(screen.getByDisplayValue("Maya")).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent" });
  });

  it("autosaves client modal drafts and renders change history", async () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent", interest: "Career" });
    historyData.push({ id: 1, bookingId: 1, changedBy: "owner-123", changedAt: new Date("2026-08-22T10:00:00Z"), changes: JSON.stringify({ name: { from: "Maya", to: "Maya Updated" } }) });
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya Draft" } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem("admin-client-draft:1") ?? "{}").name).toBe("Maya Draft"));
    expect(screen.getByText("Change history")).toBeInTheDocument();
    expect(screen.getByText(/owner-123/)).toBeInTheDocument();
    expect(screen.getByText(/name: Maya → Maya Updated/)).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
  });

  it("filters client history by search term and date range", () => {
    render(<Admin />);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search clients" }), { target: { value: "unknown" } });
    expect(screen.getByText("No requests match this filter.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search clients" }), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2027-01-01" } });
    expect(screen.getByText("No requests match this filter.")).toBeInTheDocument();
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
