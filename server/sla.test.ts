import { describe, expect, it } from "vitest";
import { aggregateSlaViolationTrend, aggregateTopSlaErrors } from "./sla";

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

  it("returns the three most frequent error codes with deterministic ordering", () => {
    const errors = aggregateTopSlaErrors([
      { errorCode: "DELIVERY_FAILED", evaluatedAt: new Date("2026-08-25T08:00:00Z") },
      { errorCode: "DELIVERY_FAILED", evaluatedAt: new Date("2026-08-25T10:00:00Z") },
      { errorCode: "RENDER_FAILED", evaluatedAt: new Date("2026-08-25T09:00:00Z") },
      { errorCode: "CALCULATION_FAILED", evaluatedAt: new Date("2026-08-25T07:00:00Z") },
      { errorCode: "CALCULATION_FAILED", evaluatedAt: new Date("2026-08-25T06:00:00Z") },
      { errorCode: "RENDER_FAILED", evaluatedAt: new Date("2026-08-25T11:00:00Z") },
      { errorCode: "DELIVERY_FAILED", evaluatedAt: new Date("2026-08-25T12:00:00Z") },
      { errorCode: "  ", evaluatedAt: new Date("2026-08-25T12:30:00Z") },
    ]);
    expect(errors).toEqual([
      { errorCode: "DELIVERY_FAILED", count: 3, latestAt: new Date("2026-08-25T12:00:00Z") },
      { errorCode: "CALCULATION_FAILED", count: 2, latestAt: new Date("2026-08-25T07:00:00Z") },
      { errorCode: "RENDER_FAILED", count: 2, latestAt: new Date("2026-08-25T11:00:00Z") },
    ]);
  });
});
