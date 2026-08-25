import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), evaluateSla: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./sla", () => ({ evaluateSla: mocks.evaluateSla }));

import { evaluateSlaHandler } from "./sla-retention";

function response() { return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }; }

describe("SLA scheduled handler", () => {
  it("rejects non-cron requests", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: false, taskUid: undefined });
    const res = response();
    await evaluateSlaHandler({ originalUrl: "/api/scheduled/evaluate-sla", headers: {} } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(mocks.evaluateSla).not.toHaveBeenCalled();
  });

  it("returns aggregate evaluation results for a cron task", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-sla" });
    mocks.evaluateSla.mockResolvedValueOnce({ enabled: true, evaluated: 4, alertsCreated: 1, notificationsSent: 1 });
    const res = response();
    await evaluateSlaHandler({ originalUrl: "/api/scheduled/evaluate-sla", headers: {} } as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ ok: true, enabled: true, evaluated: 4, alertsCreated: 1, notificationsSent: 1 });
  });

  it("does not expose internal evaluation errors", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-sla" });
    mocks.evaluateSla.mockRejectedValueOnce(new Error("database secret"));
    const res = response();
    await evaluateSlaHandler({ originalUrl: "/api/scheduled/evaluate-sla", headers: {} } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "sla-evaluation-failed", timestamp: expect.any(String) });
  });
});
