import { describe, expect, it } from "vitest";
import { assertAutomaticReportQuality } from "./report-auto-policy";
const section = {
  sectionKey: "core-themes",
  title: "Themes",
  paragraphs: ["A reflective theme invites careful consideration of patterns in daily experience. Explore a concrete example from a recent conversation, consider how your own choices influenced it, and choose one small action to try. This is an invitation to reflection rather than a statement about inevitable events.", "Consider one small change you can observe and revisit the result after a week."],
  factRefs: ["ascendant"],
  warnings: [] as string[],
};
const narrative = {
  schemaVersion: "vedic-narrative.v1",
  locale: "ru",
  sections: [
    section,
    { ...section, sectionKey: "planet-themes" },
    { ...section, sectionKey: "dasha-themes" },
  ],
  disclaimerKey: "interpretive-practice",
  modelVersion: "test",
  promptVersion: "report-narrative-v1",
};
const input = (n: unknown = narrative) => ({
  factsJson: JSON.stringify({ ascendant: "Aries" }),
  narrativeJson: JSON.stringify(n),
  locale: "ru",
});
describe("automatic report quality gate", () => {
  it("accepts validated reports with fact references", () => {
    expect(assertAutomaticReportQuality(input()).sections).toHaveLength(3);
  });
  it("keeps short reports for owner review", () => {
    expect(() =>
      assertAutomaticReportQuality(input({ ...narrative, sections: [section] }))
    ).toThrow("review");
  });
  it("holds one-line narratives and technical metadata for owner review", () => {
    for (const paragraphs of [["A single factual sentence."], [section.paragraphs[0] + " (factRefs: [ascendant])"]]) {
      expect(() => assertAutomaticReportQuality(input({ ...narrative, sections: narrative.sections.map(s => ({ ...s, paragraphs })) }))).toThrow("review");
    }
  });
  it("keeps reports with warnings for owner review", () => {
    expect(() =>
      assertAutomaticReportQuality(
        input({
          ...narrative,
          sections: [
            section,
            section,
            { ...section, warnings: ["ambiguous data"] },
          ],
        })
      )
    ).toThrow("review");
  });
  it("keeps duplicate sections for owner review", () => {
    expect(() =>
      assertAutomaticReportQuality(
        input({
          ...narrative,
          sections: [section, section, section],
        })
      )
    ).toThrow("review");
  });
  it("keeps whitespace-only content for owner review", () => {
    expect(() =>
      assertAutomaticReportQuality(
        input({
          ...narrative,
          sections: narrative.sections.map(s => ({
            ...s,
            paragraphs: ["   "],
          })),
        })
      )
    ).toThrow("review");
  });
  it("rejects inherited object properties as fact references", () => {
    expect(() =>
      assertAutomaticReportQuality(
        input({
          ...narrative,
          sections: narrative.sections.map(s => ({
            ...s,
            factRefs: ["constructor"],
          })),
        })
      )
    ).toThrow("missing fact");
  });
  it("rejects the wrong language", () => {
    expect(() =>
      assertAutomaticReportQuality({ ...input(), locale: "en" })
    ).toThrow("language");
  });
  it("rejects references to invented facts", () => {
    expect(() =>
      assertAutomaticReportQuality(
        input({
          ...narrative,
          sections: [section, section, { ...section, factRefs: ["missing"] }],
        })
      )
    ).toThrow("missing fact");
  });
});
