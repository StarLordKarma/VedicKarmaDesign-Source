import { describe, expect, it } from "vitest";
import { sendSlaChartPdfSchema, slaEvaluationRunsPageSchema } from "./admin";

describe("SLA journal filters", () => {
  it("accepts searchable run filters and rejects an invalid range", () => {
    expect(slaEvaluationRunsPageSchema.parse({ search: "database timeout", errorCode: "REPORT_TIMEOUT", status: "failed", page: 1, pageSize: 10 }).errorCode).toBe("REPORT_TIMEOUT");
    expect(slaEvaluationRunsPageSchema.safeParse({ from: "2026-08-25", to: "2026-08-01" }).success).toBe(false);
    expect(slaEvaluationRunsPageSchema.safeParse({ search: "x".repeat(121) }).success).toBe(false);
    expect(slaEvaluationRunsPageSchema.safeParse({ errorCode: "x".repeat(121) }).success).toBe(false);
  });

  it("validates owner SLA chart email payloads", () => {
    const valid = sendSlaChartPdfSchema.parse({ email: "owner@example.com", contentBase64: "JVBERi0xLjQtU0xBLVJFUE9SVA==", fileName: "sla.pdf", rangeLabel: "2026-08-01 — 2026-08-25", language: "ru" });
    expect(valid.language).toBe("ru");
    expect(sendSlaChartPdfSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(sendSlaChartPdfSchema.safeParse({ ...valid, language: "fr" }).success).toBe(false);
    expect(sendSlaChartPdfSchema.safeParse({ ...valid, contentBase64: "x".repeat(17_000_001) }).success).toBe(false);
  });
});
