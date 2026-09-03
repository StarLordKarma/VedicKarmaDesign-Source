import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), booking: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getBookingRequestById: mocks.booking, createBookingRequest: vi.fn(), deleteBookingRequest: vi.fn() }));
import { approveReportVersion, processReportJob, setReportProcessingSettings } from "./report-studio-db";

function fakeDatabase(rows: unknown[][]) {
  const duplicate = vi.fn().mockResolvedValue({});
  const values = vi.fn(() => ({ onDuplicateKeyUpdate: duplicate }));
  const update = vi.fn();
  return { select: () => ({ from: () => ({ where: () => ({ limit: async () => rows.shift() ?? [] }) }) }), insert: () => ({ values }), update, values, duplicate };
}
beforeEach(() => vi.clearAllMocks());
describe("Report Studio hardening", () => {
  it("persists the selected model and every generation limit", async () => {
    const db = fakeDatabase([[{ id: 1, aiModel: "gpt-5-mini" }]]); mocks.getDb.mockResolvedValue(db);
    await setReportProcessingSettings({ autoProcessEnabled: false, actorId: "owner", aiModel: "gpt-5-mini", maxTokens: 4500, maxSections: 5, maxParagraphChars: 1200 });
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ aiModel: "gpt-5-mini", maxTokens: 4500, maxSections: 5, maxParagraphChars: 1200 }));
    expect(db.duplicate).toHaveBeenCalledWith({ set: expect.objectContaining({ aiModel: "gpt-5-mini", maxTokens: 4500 }) });
  });
  it("rejects synthetic approval before changing any records", async () => {
    const db = fakeDatabase([[{ id: 9, pdfStorageKey: "test.pdf", status: "needs_review" }], [{ id: 7, testJob: true }]]); mocks.getDb.mockResolvedValue(db);
    await expect(approveReportVersion({ reportJobId: 7, versionId: 9, actorId: "owner" })).rejects.toThrow("Synthetic");
    expect(db.update).not.toHaveBeenCalled();
  });
  it("rejects approval without validated calculation facts", async () => {
    const db = fakeDatabase([[{ id: 9, pdfStorageKey: "test.pdf", status: "needs_review" }], [{ id: 7, testJob: false, status: "needs_review" }], [{ validationStatus: "invalid" }]]); mocks.getDb.mockResolvedValue(db);
    await expect(approveReportVersion({ reportJobId: 7, versionId: 9, actorId: "owner" })).rejects.toThrow("Validated");
    expect(db.update).not.toHaveBeenCalled();
  });
  it("bounds calculation retries before invoking any provider", async () => {
    const db = fakeDatabase([[{ id: 7, bookingId: 3, status: "calculation_failed", attemptCount: 3 }]]); mocks.getDb.mockResolvedValue(db); mocks.booking.mockResolvedValue({ id: 3 });
    await expect(processReportJob({ reportJobId: 7, actorId: "owner" })).rejects.toThrow("Retry limit");
    expect(db.update).not.toHaveBeenCalled();
  });
});
