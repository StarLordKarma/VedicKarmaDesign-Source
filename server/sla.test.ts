import { describe, expect, it } from "vitest";
import { aggregateSlaViolationTrend } from "./sla";

describe("SLA violation trend aggregation", () => {
  it("groups actual evaluation runs by UTC day and preserves both violation types", () => {
    const trend = aggregateSlaViolationTrend([
      { evaluatedAt: new Date("2026-08-23T08:00:00Z"), preparationViolations: 2, deliveryViolations: 1 },
      { evaluatedAt: new Date("2026-08-23T18:00:00Z"), preparationViolations: 1, deliveryViolations: 0 },
      { evaluatedAt: new Date("2026-08-22T18:00:00Z"), preparationViolations: 0, deliveryViolations: 3 },
    ]);
    expect(trend).toEqual([
      { date: "2026-08-22", preparationViolations: 0, deliveryViolations: 3, totalViolations: 3 },
      { date: "2026-08-23", preparationViolations: 3, deliveryViolations: 1, totalViolations: 4 },
    ]);
  });
});
