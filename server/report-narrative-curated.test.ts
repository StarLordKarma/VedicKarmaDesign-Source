import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./report-narrative", async original => ({ ...await original<typeof import("./report-narrative")>(), generateNarrativeDraft: vi.fn() }));
import { generateNarrativeDraft } from "./report-narrative";
import { buildCuratedNarrative, generateProductionNarrative } from "./report-narrative-curated";
import { calculateVedicSnapshot } from "./vedic-astrology-calculator";
import { assertAutomaticReportQuality } from "./report-auto-policy";
import { TECHNICAL_FACT_TEXT } from "../shared/vedic-labels";
const facts = calculateVedicSnapshot({ localDate: "2000-01-01", localTime: "12:00", timeZoneOffsetMinutes: 60, latitude: 52.52, longitude: 13.405 });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("safe narrative recovery", () => {
  it.each(["en", "ru", "de", "es"] as const)("produces six substantive, fact-referenced %s sections without an external model", locale => {
    const narrative = buildCuratedNarrative(facts, locale);
    expect(narrative.sections).toHaveLength(6);
    expect(narrative.sections.every(s => s.paragraphs.length === 2 && s.paragraphs.join(" ").length >= 500 && !TECHNICAL_FACT_TEXT.test(s.paragraphs.join(" ")))).toBe(true);
    expect(narrative.sections[3].paragraphs[0]).toContain("Swati");
    expect(() => assertAutomaticReportQuality({ factsJson: JSON.stringify(facts), narrativeJson: JSON.stringify(narrative), locale })).not.toThrow();
  });
  it("uses the curated source after invalid or unavailable AI, and records the source honestly", async () => {
    vi.mocked(generateNarrativeDraft).mockRejectedValue(new Error("invalid AI draft"));
    const result = await generateProductionNarrative({ facts, locale: "ru" }); expect(result.usedFallback).toBe(true); expect(result.modelVersion).toBe("curated-vedic-v1");
  });
  it("can fail closed for an operator who disables fallback and never invents missing chart facts", async () => {
    vi.stubEnv("REPORT_ALLOW_CURATED_FALLBACK", "false"); vi.mocked(generateNarrativeDraft).mockRejectedValue(new Error("model unavailable")); await expect(generateProductionNarrative({ facts, locale: "en" })).rejects.toThrow("model unavailable");
    expect(() => buildCuratedNarrative({}, "en")).toThrow("complete chart");
  });
});
