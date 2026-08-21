import { describe, expect, it, vi } from "vitest";
import { applyAdminBookingUpdate } from "./admin-update-flow";

describe("admin booking update flow", () => {
  it("persists status, private note, and admin audit identity", async () => {
    const update = vi.fn(async (input) => ({ ...input, statusUpdatedAt: new Date() }));
    const result = await applyAdminBookingUpdate({ id: 21, status: "completed", adminNote: "PDF delivered", adminOpenId: "owner-123", update });
    expect(update).toHaveBeenCalledWith({ id: 21, status: "completed", adminNote: "PDF delivered", statusUpdatedBy: "owner-123" });
    expect(result.status).toBe("completed");
    expect(result.adminNote).toBe("PDF delivered");
  });

  it("supports note-only updates", async () => {
    const update = vi.fn(async (input) => input);
    await applyAdminBookingUpdate({ id: 21, adminNote: "Follow up tomorrow", adminOpenId: "owner-123", update });
    expect(update).toHaveBeenCalledWith({ id: 21, status: undefined, adminNote: "Follow up tomorrow", statusUpdatedBy: "owner-123" });
  });
});
