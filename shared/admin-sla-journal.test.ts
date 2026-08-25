import { describe, expect, it } from "vitest";
import { slaEvaluationRunsPageSchema } from "./admin";

describe("SLA journal filters", () => {
  it("accepts searchable run filters and rejects an invalid range", () => {
    expect(slaEvaluationRunsPageSchema.parse({ search: "database timeout", errorCode: "REPORT_TIMEOUT", status: "failed", page: 1, pageSize: 10 }).errorCode).toBe("REPORT_TIMEOUT");
    expect(slaEvaluationRunsPageSchema.safeParse({ from: "2026-08-25", to: "2026-08-01" }).success).toBe(false);
    expect(slaEvaluationRunsPageSchema.safeParse({ search: "x".repeat(121) }).success).toBe(false);
    expect(slaEvaluationRunsPageSchema.safeParse({ errorCode: "x".repeat(121) }).success).toBe(false);
  });
});
