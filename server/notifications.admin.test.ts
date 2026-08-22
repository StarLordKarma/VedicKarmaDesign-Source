import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { notifyOwner } from "./_core/notification";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

function context(role: "user" | "admin", openId = "test-owner"): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: 1,
      openId,
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

  it("loads the activity summary for the configured owner", async () => {
    const caller = appRouter.createCaller(context("admin", ENV.ownerOpenId));
    const summary = await caller.admin.activitySummary();
    expect(summary).toEqual(expect.objectContaining({
      deliveryFailureCount: expect.any(Number),
      pendingPaymentCount: expect.any(Number),
      recentlyEditedClientCount: expect.any(Number),
      deliveryFailures: expect.any(Array),
      pendingPayments: expect.any(Array),
      recentlyEditedClients: expect.any(Array),
    }));
  });

  it("rejects an admin-role user whose identity is not the configured owner", async () => {
    const caller = appRouter.createCaller(context("admin", "another-admin-open-id"));
    await expect(caller.admin.bookingList()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.activitySummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a non-owner from every admin write/export action", async () => {
    const caller = appRouter.createCaller(context("admin", "another-admin-open-id"));
    await expect(caller.admin.updateBooking({ id: 1, status: "completed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportCsv()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.exportPdf()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.attachNatalPdf({ bookingId: 1, fileName: "chart.pdf", contentBase64: "JVBERi0xLjQ=" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a non-admin and unauthenticated caller from PDF delivery", async () => {
    const nonAdmin = appRouter.createCaller(context("user"));
    await expect(nonAdmin.admin.sendNatalPdf({ bookingId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unauthenticated = appRouter.createCaller({ ...context("user"), user: null });
    await expect(unauthenticated.admin.sendNatalPdf({ bookingId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
