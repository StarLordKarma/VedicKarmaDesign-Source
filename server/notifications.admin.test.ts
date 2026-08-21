import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { notifyOwner } from "./_core/notification";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "admin"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 1,
      openId: "test-owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req: { protocol: "https", headers: {}, get: () => "example.com" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("owner notifications and admin access", () => {
  it("dispatches an owner notification through the configured service", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(notifyOwner({ title: "New booking", content: "Booking #1" })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("rejects a non-admin from the booking list", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.bookingList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
