import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
vi.mock("./sdk", () => ({ sdk: { authenticateRequest } }));

import { authenticateScheduledActor, ScheduledAuthError, scheduledTaskGuard } from "./scheduledAuth";

function request(headers: Record<string, string> = {}) {
  return { header: (name: string) => headers[name.toLowerCase()] } as never;
}

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as never;
}

describe("scheduled task authentication", () => {
  beforeEach(() => {
    process.env.SCHEDULED_TASK_SECRET = "scheduled-test-secret";
    authenticateRequest.mockReset();
  });

  it("accepts an external scheduler secret without platform cron credentials", async () => {
    const req = request({ authorization: "Bearer scheduled-test-secret" });
    const next = vi.fn();
    await scheduledTaskGuard(req, response(), next);
    expect(next).toHaveBeenCalledOnce();
    await expect(authenticateScheduledActor(req)).resolves.toBe("external-scheduler");
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it("rejects an invalid external scheduler secret", async () => {
    const res = response() as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
    const next = vi.fn();
    await scheduledTaskGuard(request({ "x-scheduled-task-secret": "wrong" }), res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("retains platform cron authentication when no static secret is configured", async () => {
    process.env.SCHEDULED_TASK_SECRET = "";
    const req = request();
    const next = vi.fn();
    await scheduledTaskGuard(req, response(), next);
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "platform-task" });
    await expect(authenticateScheduledActor(req)).resolves.toBe("platform-task");
    authenticateRequest.mockResolvedValue({ isCron: false, taskUid: null });
    await expect(authenticateScheduledActor(req)).rejects.toBeInstanceOf(ScheduledAuthError);
  });
});
