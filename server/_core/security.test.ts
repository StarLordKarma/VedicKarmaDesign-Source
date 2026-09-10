import { describe, expect, it, vi } from "vitest";
import { applicationSecurityHeaders, crossSiteWriteGuard } from "./security";

function response() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("browser request security", () => {
  it("rejects cross-site browser writes to application APIs", () => {
    const res = response();
    const next = vi.fn();
    crossSiteWriteGuard(
      {
        method: "POST",
        path: "/api/trpc/admin.update",
        header: (name: string) =>
          name === "sec-fetch-site" ? "cross-site" : undefined,
      } as any,
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows signed provider webhooks and same-site writes", () => {
    for (const [path, site] of [
      ["/api/nowpayments/ipn", "cross-site"],
      ["/api/trpc/booking.submit", "same-origin"],
    ]) {
      const next = vi.fn();
      crossSiteWriteGuard(
        {
          method: "POST",
          path,
          header: () => site,
        } as any,
        response(),
        next
      );
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("sets baseline browser security headers", () => {
    const res = response();
    const next = vi.fn();
    applicationSecurityHeaders({} as any, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff"
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
