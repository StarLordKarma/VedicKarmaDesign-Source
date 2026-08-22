import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), cleanupExpiredReceiptFiles: vi.fn(), getReceiptRetentionHours: vi.fn() }));
const { authenticateRequest, cleanupExpiredReceiptFiles, getReceiptRetentionHours } = mocks;

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ cleanupExpiredReceiptFiles: mocks.cleanupExpiredReceiptFiles, getReceiptRetentionHours: mocks.getReceiptRetentionHours }));

import { cleanupReceiptFilesHandler } from "./receipt-retention";

function makeResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return response;
}

describe("receipt retention scheduled handler", () => {
  it("rejects ordinary authenticated requests", async () => {
    authenticateRequest.mockResolvedValueOnce({ isCron: false, taskUid: undefined });
    const response = makeResponse();

    await cleanupReceiptFilesHandler({ originalUrl: "/api/scheduled/cleanup-receipts", headers: {} } as any, response as any);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(cleanupExpiredReceiptFiles).not.toHaveBeenCalled();
  });

  it("cleans expired metadata only for an authenticated cron task and reports the configured period", async () => {
    authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-receipt-cleanup" });
    cleanupExpiredReceiptFiles.mockResolvedValueOnce(4);
    getReceiptRetentionHours.mockResolvedValueOnce(72);
    const response = makeResponse();

    await cleanupReceiptFilesHandler({ originalUrl: "/api/scheduled/cleanup-receipts", headers: {} } as any, response as any);

    expect(cleanupExpiredReceiptFiles).toHaveBeenCalledOnce();
    expect(response.json).toHaveBeenCalledWith({ ok: true, deleted: 4, retentionHours: 72 });
  });

  it("returns a diagnostic 500 payload when cleanup fails", async () => {
    authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-receipt-cleanup" });
    cleanupExpiredReceiptFiles.mockRejectedValueOnce(new Error("db unavailable"));
    getReceiptRetentionHours.mockResolvedValueOnce(48);
    const response = makeResponse();

    await cleanupReceiptFilesHandler({ originalUrl: "/api/scheduled/cleanup-receipts", headers: {} } as any, response as any);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ error: "Error: db unavailable", timestamp: expect.any(String) }));
  });
});
