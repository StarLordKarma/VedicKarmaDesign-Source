import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), booking: vi.fn(), storage: vi.fn(), pdf: vi.fn(), email: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getBookingRequestById: mocks.booking, createBookingRequest: vi.fn(), deleteBookingRequest: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: mocks.storage }));
vi.mock("./export", () => ({ buildFullNatalReportPdf: mocks.pdf }));
vi.mock("./client-delivery", () => ({ sendClientReportPdf: mocks.email }));
import { calculationResults, narrativeDrafts, reportJobs, reportVersions } from "../drizzle/schema";
import { reviseReportNarrative } from "./report-studio-db";
const narrative = { schemaVersion: "vedic-narrative.v1", locale: "en", sections: [{ sectionKey: "core-themes", title: "Themes", paragraphs: ["A revised reflection."], factRefs: ["d1"], warnings: [] }], disclaimerKey: "interpretive-practice", modelVersion: "reviewed", promptVersion: "report-narrative-v1" };
beforeEach(() => vi.clearAllMocks());

function database(status = "needs_review") {
  const data = new Map<unknown, unknown[]>([
    [reportJobs, [{ id: 7, bookingId: 3, language: "en", packageType: "basic", status }]],
    [reportVersions, [{ id: 9, versionNumber: 1, status, templateVersion: "v1", pdfStorageKey: "old.pdf" }]],
    [calculationResults, [{ validationStatus: "valid", factsJson: '{"d1":[]}' }]],
    [narrativeDrafts, [{ modelName: "existing-model" }]],
  ]);
  const inserts: Array<{ table: unknown; value: any }> = [];
  const updates: Array<{ table: unknown; value: any }> = [];
  const db = {
    select: () => ({ from: (table: unknown) => {
      const rows = data.get(table) ?? [];
      const chain = { where: () => chain, orderBy: () => chain, limit: async () => rows, then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
      return chain;
    } }),
    insert: (table: unknown) => ({ values: async (value: unknown) => { inserts.push({ table, value }); return [{ insertId: 10 }]; } }),
    update: (table: unknown) => ({ set: (value: unknown) => ({ where: async () => { updates.push({ table, value }); return [{ affectedRows: 1 }]; } }) }),
    transaction: async (fn: (transaction: unknown) => unknown) => fn(db),
  };
  mocks.getDb.mockResolvedValue(db); mocks.booking.mockResolvedValue({ id: 3, name: "Synthetic" }); mocks.pdf.mockResolvedValue(Buffer.from("%PDF-test")); mocks.storage.mockResolvedValue({ key: "new.pdf" });
  return { inserts, updates };
}

it("creates an immutable new PDF version and audit without sending email", async () => {
  const db = database();
  await expect(reviseReportNarrative({ reportJobId: 7, baseVersionId: 9, actorId: "owner", narrativeJson: JSON.stringify(narrative) })).resolves.toEqual({ versionNumber: 2 });
  expect(db.inserts.find(row => row.table === reportVersions)?.value).toMatchObject({ versionNumber: 2, pdfStorageKey: "new.pdf", status: "needs_review" });
  expect(db.updates.find(row => row.table === reportVersions)?.value).toEqual({ status: "superseded" });
  expect(mocks.storage.mock.calls[0][0]).toBe("report-studio/7/v2-preview.pdf");
  expect(mocks.email).not.toHaveBeenCalled();
});

it("cannot rewrite an approved or sent version", async () => {
  database("sent");
  await expect(reviseReportNarrative({ reportJobId: 7, baseVersionId: 9, actorId: "owner", narrativeJson: JSON.stringify(narrative) })).rejects.toThrow("unapproved");
  expect(mocks.pdf).not.toHaveBeenCalled();
});
