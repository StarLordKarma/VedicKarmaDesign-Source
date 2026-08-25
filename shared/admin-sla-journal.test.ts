import { describe, expect, it } from "vitest";
import { slaEvaluationRunsPageSchema } from "./admin";

describe("SLA journal filters", () => {
  it("accepts searchable run filters and rejects an invalid range", () => {
    expect(slaEvaluationRunsPageSchema.parse({ search: "database timeout", status: "failed", page: 1, pageSize: 10 }).search).toBe("database timeout");
    expect(slaEvaluationRunsPageSchema.safeParse({ from: "2026-08-25", to: "2026-08-01" }).success).toBe(false);
    expect(slaEvaluationRunsPageSchema.safeParse({ search: "x".repeat(121) }).success).toBe(false);
  });
});
