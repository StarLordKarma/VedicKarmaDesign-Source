// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin, { autosaveIntervalStorageKey, draftSavedAtStorageKey, draftStorageKey, formatAdminDate, formatAutosaveTimestamp, getBulkDeliveryOutcome, matchesClientSearch, sortBookingRows } from "./Admin";
import { formatCurrency, roundCurrencyAmount } from "@shared/currency";

const { authState, startLoginMock, toastSuccess } = vi.hoisted(() => ({ authState: { user: { role: "admin" } as { role: string } | null }, startLoginMock: vi.fn(), toastSuccess: vi.fn() }));
const updateMutate = vi.fn();
const exportCsvMutate = vi.fn();
const exportPdfMutate = vi.fn();
const exportActivityMutate = vi.fn();
const exportPricingHistoryMutate = vi.fn();
const exportSmokeRunsMutate = vi.fn();
const updatePricingMutate = vi.fn();
const updateReceiptRetentionMutate = vi.fn();
const runManualSmokeTestMutate = vi.fn();
const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
const receiptRetentionData = 48;
const pricingData = [{ currency: "USD", basicUsd: 25, numerologyAddonUsd: 10 }, { currency: "EUR", basicUsd: 23, numerologyAddonUsd: 9 }, { currency: "GBP", basicUsd: 20, numerologyAddonUsd: 8 }];
const pricingHistoryData = { items: [{ id: 1, currency: "USD", oldBasicAmount: 25, oldNumerologyAddonAmount: 10, newBasicAmount: 40, newNumerologyAddonAmount: 15, changedAt: new Date("2026-08-22T12:00:00Z"), changedBy: "owner-123", changedByName: "Anika Jyotish" }], total: 11, page: 1, pageSize: 10, totalPages: 2 };
const smokeTestRunsData = { items: [{ runId: "production-smoke-1724320000000", status: "succeeded" as const, result: JSON.stringify({ ok: true, checkoutCurrency: "EUR" }), startedAt: new Date("2026-08-22T12:00:00Z"), finishedAt: new Date("2026-08-22T12:00:01Z"), durationMs: 1000 }], total: 11, page: 1, pageSize: 10, totalPages: 2 };
const smokeTestRunsPageTwo = { items: [{ runId: "production-smoke-1724320000001", status: "failed" as const, result: JSON.stringify({ ok: false, error: "timeout" }), startedAt: new Date("2026-08-22T11:00:00Z"), finishedAt: new Date("2026-08-22T11:00:03Z"), durationMs: 3000 }], total: 11, page: 2, pageSize: 10, totalPages: 2 };
const smokeQueryInputs: unknown[] = [];
const sendPdfMutate = vi.fn();
const bulkSendPdfMutate = vi.fn();
const editClientMutate = vi.fn();
const attachMutateAsync = vi.fn().mockResolvedValue(undefined);
const options: Array<{ onSuccess?: (result: any) => void; onError?: () => void }> = [];
const row = { id: 1, name: "Maya", email: "maya@example.com", birthDate: "1990-04-12", birthTime: "08:30", birthCity: "Berlin", birthCountry: "Germany", language: "English", addon: 0, totalUsd: 25, paymentStatus: "finished", status: "new", adminNote: null, createdAt: new Date("2026-01-01T00:00:00Z"), natalPdfUrl: null, natalPdfName: null };
const queryData = [row];
const historyData: Array<{ id: number; bookingId: number; changedBy: string; changedAt: Date; changes: string }> = [];
const activityData = { deliveryFailureCount: 0, pendingPaymentCount: 0, recentlyEditedClientCount: 0, deliveryFailures: [] as Array<{ id: number; name: string; email: string; deliveryError: string | null; createdAt: Date }>, pendingPayments: [] as Array<{ id: number; name: string; email: string; totalUsd: number; paymentStatus: string | null; createdAt: Date }>, recentlyEditedClients: [] as Array<{ id: number; bookingId: number; name: string; email: string; changedBy: string; changedAt: Date; changes: string }> };

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: authState.user, loading: false }) }));
vi.mock("@/const", () => ({ startLogin: startLoginMock }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { bookingList: { invalidate: vi.fn() }, activitySummary: { invalidate: vi.fn() }, pricing: { invalidate: vi.fn() }, pricingHistory: { invalidate: vi.fn() }, receiptRetention: { invalidate: vi.fn() } } }),
    admin: {
      bookingList: { useQuery: () => ({ data: queryData, isLoading: false, error: null }) },
      activitySummary: { useQuery: (_input: unknown) => ({ data: activityData, isLoading: false, error: null }) },
      pricing: { useQuery: () => ({ data: pricingData, isLoading: false, error: null }) },
      receiptRetention: { useQuery: () => ({ data: receiptRetentionData, isLoading: false, error: null }) },
      pricingHistory: { useQuery: () => ({ data: pricingHistoryData, isLoading: false, error: null }) },
      smokeTestRuns: { useQuery: (input: { page?: number; status?: string; sort?: string } | undefined) => { smokeQueryInputs.push(input); return { data: input?.page === 2 ? smokeTestRunsPageTwo : smokeTestRunsData, isLoading: false, error: null, refetch: vi.fn() }; } },
      runManualSmokeTest: { useMutation: (config: typeof options[number]) => { options[9] = config; return { mutate: runManualSmokeTestMutate, isPending: false }; } },
      clientHistory: { useQuery: () => ({ data: historyData, isLoading: false, error: null }) },
      updateBooking: { useMutation: () => ({ mutate: updateMutate, isPending: false, isSuccess: false }) },
      updatePricing: { useMutation: (config: typeof options[number]) => { options[7] = config; return { mutate: updatePricingMutate, isPending: false }; } },
      updateReceiptRetention: { useMutation: (config: typeof options[number]) => { options[11] = config; return { mutate: updateReceiptRetentionMutate, isPending: false }; } },
      exportCsv: { useMutation: (config: typeof options[number]) => { options[0] = config; return { mutate: exportCsvMutate, isPending: false }; } },
      exportPdf: { useMutation: (config: typeof options[number]) => { options[1] = config; return { mutate: exportPdfMutate, isPending: false }; } },
      exportActivityCsv: { useMutation: (config: typeof options[number]) => { options[6] = config; return { mutate: exportActivityMutate, isPending: false }; } },
      exportPricingHistoryCsv: { useMutation: (config: typeof options[number]) => { options[8] = config; return { mutate: exportPricingHistoryMutate, isPending: false }; } },
      exportSmokeTestRunsCsv: { useMutation: (config: typeof options[number]) => { options[10] = config; return { mutate: exportSmokeRunsMutate, isPending: false }; } },
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
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText: clipboardWriteText } });
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:smoke-json") });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    queryData.splice(1);
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent", interest: null, language: "English" });
    historyData.splice(0);
    smokeQueryInputs.splice(0);
    activityData.deliveryFailureCount = 0; activityData.pendingPaymentCount = 0; activityData.recentlyEditedClientCount = 0; activityData.deliveryFailures.splice(0); activityData.pendingPayments.splice(0); activityData.recentlyEditedClients.splice(0);
    localStorage.clear();
    authState.user = { role: "admin" };
    startLoginMock.mockReset(); toastSuccess.mockReset();
    options.length = 0;
    exportSmokeRunsMutate.mockReset();
    updateMutate.mockReset();
    exportCsvMutate.mockReset();
    exportPdfMutate.mockReset();
    exportActivityMutate.mockReset();
    exportPricingHistoryMutate.mockReset();
    updatePricingMutate.mockReset();
    updateReceiptRetentionMutate.mockReset();
    pricingData[0].basicUsd = 25; pricingData[0].numerologyAddonUsd = 10; pricingData[1].basicUsd = 23; pricingData[1].numerologyAddonUsd = 9; pricingData[2].basicUsd = 20; pricingData[2].numerologyAddonUsd = 8;
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
    expect(screen.queryByText("Activity overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick delivery queue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in as owner" }));
    expect(startLoginMock).toHaveBeenCalledOnce();
  });

  it("blocks the mobile PDF workflow for authenticated non-admin users", () => {
    authState.user = { role: "user" };
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<Admin />);
    expect(screen.getByText("Admin access required")).toBeInTheDocument();
    expect(screen.queryByText("Quick delivery queue")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send PDF" })).not.toBeInTheDocument();
  });

  it("toggles RU/EN labels and persists admin-locale", () => {
    render(<Admin />);
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
    expect(screen.getAllByText("Page 1 of 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Client 11")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByText("Page 2 of 2").length).toBeGreaterThan(0);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getAllByText("Page 1 of 2").length).toBeGreaterThan(0);
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

  it("renders owner activity metrics, persists display preferences, and supports mobile quick delivery", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "failed" });
    activityData.deliveryFailures.push({ id: 1, name: "Maya", email: "maya@example.com", deliveryError: "Mailbox rejected", createdAt: new Date("2026-01-01T00:00:00Z") }, { id: 4, name: "Nina", email: "nina@example.com", deliveryError: "Temporary provider failure", createdAt: new Date("2026-01-04T00:00:00Z") });
    activityData.pendingPayments.push({ id: 2, name: "Leo", email: "leo@example.com", totalUsd: 35, paymentStatus: "waiting", createdAt: new Date("2026-01-02T00:00:00Z") });
    activityData.recentlyEditedClients.push({ id: 3, bookingId: 1, name: "Maya", email: "maya@example.com", changedBy: "owner-123", changedAt: new Date("2026-01-03T00:00:00Z"), changes: "{}" });
    activityData.deliveryFailureCount = 9; activityData.pendingPaymentCount = 11; activityData.recentlyEditedClientCount = 13;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<Admin />);
    expect(screen.getByText("Activity overview")).toBeInTheDocument();
    expect(screen.getByText("Quick delivery queue").closest("section")).toHaveClass("sm:hidden");
    expect(screen.getByText(/Mailbox rejected/)).toBeInTheDocument();
    expect(screen.getByText(/Temporary provider failure/)).toBeInTheDocument();
    expect(screen.getByText("Pending payments")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry PDF delivery: Maya/ }));
    expect(sendPdfMutate).toHaveBeenCalledWith({ bookingId: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Retry PDF delivery: Nina/ }));
    expect(sendPdfMutate).toHaveBeenCalledWith({ bookingId: 4 });
    fireEvent.change(screen.getByLabelText("Activity from"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Activity to"), { target: { value: "2026-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Export activity CSV" }));
    expect(exportActivityMutate).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-01-31" });
    act(() => options[6].onSuccess?.({ contentBase64: btoa("Event type,Booking ID"), filename: "activity.csv" }));
    expect(screen.getByRole("status")).toHaveTextContent("Activity CSV exported.");
    fireEvent.change(screen.getByRole("combobox", { name: "Timezone" }), { target: { value: "UTC" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Date format" }), { target: { value: "iso" } });
    expect(localStorage.getItem("admin-timezone")).toBe("UTC");
    expect(localStorage.getItem("admin-date-format")).toBe("iso");
    expect(screen.getByText("Saved locally")).toBeInTheDocument();
    cleanup();
    render(<Admin />);
    expect(screen.getByRole("combobox", { name: "Timezone" })).toHaveValue("UTC");
    expect(screen.getByRole("combobox", { name: "Date format" })).toHaveValue("iso");
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send PDF" }));
    expect(sendPdfMutate).toHaveBeenCalledWith({ bookingId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent" });
  });

  it("edits receipt retention from the owner settings panel and sends the selected allowed value", async () => {
    render(<Admin />);
    const retention = screen.getByRole("combobox", { name: "Retention period" });
    fireEvent.change(retention, { target: { value: "72" } });
    expect(screen.getByRole("button", { name: "Save retention" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save retention" }));
    expect(updateReceiptRetentionMutate).toHaveBeenCalledWith({ retentionHours: 72 });
    options[11]?.onSuccess?.({ retentionHours: 72, updatedBy: "owner-123" });
    await waitFor(() => expect(screen.getByText("Retention updated.")).toBeInTheDocument());
  });

  it("edits service prices from the owner pricing panel and shows success feedback", () => {
    render(<Admin />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Basic reading price" }), { target: { value: "40" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Numerology add-on price" }), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save prices" }));
    expect(updatePricingMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Save these pricing changes?")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("USD");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("$40");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("$15");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("$55");
    fireEvent.click(screen.getByRole("button", { name: "Save prices" }));
    expect(updatePricingMutate).toHaveBeenCalledWith({ currency: "USD", basicUsd: 40, numerologyAddonUsd: 15 });
    act(() => options[7].onSuccess?.({ basicUsd: 40, numerologyAddonUsd: 15 }));
    expect(screen.getByRole("status")).toHaveTextContent("Prices updated.");
    expect(screen.getByRole("status")).toHaveClass("bg-emerald-50", "transition-[opacity,transform]");
    expect(screen.getByText("Pricing change history")).toBeInTheDocument();
    expect(screen.getByText("Interface language: EN")).toBeInTheDocument();
    expect(screen.getByText("Formatting locale: en-US")).toBeInTheDocument();
    expect(screen.getAllByText(/Anika Jyotish/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Smoke-test run journal|Журнал запусков smoke-тестов/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Succeeded|Успешно/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View full JSON" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View full JSON" }));
    expect(screen.getByRole("dialog")).toHaveTextContent('"checkoutCurrency": "EUR"');
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining('"checkoutCurrency": "EUR"'));
    fireEvent.click(screen.getByRole("button", { name: "Download .json" }));
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Run smoke-test" }));
    expect(runManualSmokeTestMutate).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "25" } });
    expect(smokeQueryInputs.at(-1)).toEqual(expect.objectContaining({ page: 1, pageSize: 25 }));
    fireEvent.click(screen.getByLabelText("Select visible runs"));
    expect(screen.getByRole("button", { name: /Download selected JSON/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Download selected JSON/ }));
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export smoke CSV" }));
    expect(exportSmokeRunsMutate).toHaveBeenCalledWith({ status: undefined, sort: "started_desc" });
    fireEvent.change(screen.getByRole("combobox", { name: /Status|Статус/ }), { target: { value: "succeeded" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Sort runs|Сортировка запусков/ }), { target: { value: "duration_desc" } });
    expect(smokeQueryInputs.at(-1)).toEqual(expect.objectContaining({ status: "succeeded", sort: "duration_desc", page: 1, pageSize: 25 }));
    const nextHistoryButtons = screen.getAllByRole("button", { name: /Next history page|Следующая страница истории/ });
    expect(nextHistoryButtons.length).toBeGreaterThanOrEqual(2);
    expect(nextHistoryButtons[nextHistoryButtons.length - 1]).toBeEnabled();
    fireEvent.click(nextHistoryButtons[nextHistoryButtons.length - 1]);
    expect(screen.getByText("production-smoke-1724320000001")).toBeInTheDocument();
    expect(smokeQueryInputs.at(-1)).toEqual(expect.objectContaining({ page: 2, status: "succeeded", sort: "duration_desc" }));
    fireEvent.click(screen.getByRole("button", { name: "Export pricing history CSV" }));
    expect(exportPricingHistoryMutate).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("combobox", { name: "Pricing history currency" }), { target: { value: "EUR" } });
    fireEvent.change(screen.getByLabelText("Pricing history from"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Pricing history to"), { target: { value: "2026-08-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Export pricing history CSV" }));
    expect(exportPricingHistoryMutate).toHaveBeenLastCalledWith({ currency: "EUR", from: "2026-08-01", to: "2026-08-22" });
    fireEvent.click(screen.getByRole("button", { name: "Clear history filters" }));
    expect(screen.getByRole("combobox", { name: "Pricing history currency" })).toHaveValue("all");
    expect(screen.getByLabelText("Pricing history from")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("JSON downloaded.");
    fireEvent.change(screen.getByRole("combobox", { name: "Currency" }), { target: { value: "EUR" } });
    expect(screen.getByRole("spinbutton", { name: "Basic reading price" })).toHaveValue(23);
    expect(screen.getAllByText((_, node) => Boolean(node?.textContent?.includes("32") && node.textContent.includes("€"))).length).toBeGreaterThan(0);
  });

  it("formats supported currencies with locale-aware symbols and rounding", () => {
    expect(formatCurrency(25.4, "USD", "en-US")).toBe("$25");
    expect(formatCurrency(23.6, "EUR", "de-DE")).toBe("24 €");
    expect(formatCurrency(20.4, "GBP", "en-GB")).toBe("£20");
    expect(roundCurrencyAmount(23.6, "EUR")).toBe(24);
  });

  it("formats admin dates in UTC ISO format", () => {
    expect(formatAdminDate(new Date("2026-01-01T12:34:56Z"), "UTC", "iso")).toBe("2026-01-01 12:34:56");
  });

  it("shows a saved-draft badge and clears the draft from the modal", () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent" });
    localStorage.setItem(draftStorageKey(1), JSON.stringify({ name: "Maya Draft" })); localStorage.setItem(draftSavedAtStorageKey(1), String(new Date("2026-08-22T12:34:56Z").getTime()));
    render(<Admin />);
    expect(screen.getByText("Unsaved draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(screen.getByDisplayValue("Maya Draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.getByText("Discard this draft?")).toBeInTheDocument();
    expect(localStorage.getItem(draftStorageKey(1))).not.toBeNull();
    const discardActions = screen.getAllByRole("button", { name: "Discard draft" });
    fireEvent.click(discardActions[discardActions.length - 1]);
    expect(toastSuccess).toHaveBeenCalledWith("Draft discarded");
    expect(localStorage.getItem(draftStorageKey(1))).toBeNull();
    expect(localStorage.getItem(draftSavedAtStorageKey(1))).toBeNull();
    expect(screen.getByDisplayValue("Maya")).toBeInTheDocument();
    Object.assign(queryData[0], { natalPdfKey: null, natalPdfUrl: null, natalPdfName: null, deliveryStatus: "not_sent" });
  });

  it("autosaves client modal drafts and renders change history", async () => {
    Object.assign(queryData[0], { natalPdfKey: "natal-charts/1/chart.pdf", natalPdfUrl: "/manus-storage/chart.pdf", natalPdfName: "chart.pdf", deliveryStatus: "sent", interest: "Career" });
    historyData.push({ id: 1, bookingId: 1, changedBy: "owner-123", changedAt: new Date("2026-08-22T10:00:00Z"), changes: JSON.stringify({ name: { from: "Maya", to: "Maya Updated" } }) });
    render(<Admin />);
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya Draft" } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem("admin-client-draft:1") ?? "{}").name).toBe("Maya Draft"), { timeout: 3000 });
    expect(toastSuccess).toHaveBeenCalledWith("Draft saved automatically");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));
    expect(screen.getByDisplayValue("Maya Draft")).toBeInTheDocument();
    const savedAt = Number(localStorage.getItem(draftSavedAtStorageKey(1)));
    expect(savedAt).toBeGreaterThan(0);
    expect(screen.getByText((content) => content.includes(formatAutosaveTimestamp(savedAt)))).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Autosave interval" })).toHaveValue("1000");
    fireEvent.change(screen.getByRole("combobox", { name: "Autosave interval" }), { target: { value: "2000" } });
    expect(localStorage.getItem(autosaveIntervalStorageKey())).toBe("2000");
    expect(screen.getByText("Change history")).toBeInTheDocument();
    expect(screen.getAllByText(/owner-123/).length).toBeGreaterThan(0);
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
