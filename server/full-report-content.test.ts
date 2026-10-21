import { describe, expect, it } from "vitest";
import { buildReportContent } from "./full-report-content";

const facts = { input: { localDate: "2000-01-01", localTime: "12:00", latitude: 52.52, longitude: 13.4, timeZoneOffsetMinutes: 60 }, ascendant: { sign: 11, degreeInSign: 27.74 }, planets: [{ planet: "Sun", sign: 8, degreeInSign: 16.47, nakshatra: 19, pada: 1, retrograde: false }], d1: [], d9: [], aspects: [], vimshottari: { periods: [] } };
const narrative = { sections: [{ title: "Reflection", paragraphs: ["A position at 16.473226740232576 degrees (factRefs: [\"planets[0].degreeInSign\"]) invites reflection."] }] };
describe("client report content", () => {
  it("uses correct zero-based signs and houses and excludes technical citations", () => {
    const pages = buildReportContent({ locale: "en", packageType: "basic", facts, narrative });
    const sun = pages.find(page => page.title.startsWith("Sun"))!;
    expect(sun.body).toContain("Sign: Sagittarius");
    expect(sun.body).toContain("Whole-sign house: 10");
    expect(pages[pages.length - 1].body).toContain("16.47 degrees");
    expect(pages[pages.length - 1].body).not.toContain("factRefs");
    expect(pages.filter(page => page.title === "Reflection")).toHaveLength(1);
  });
  it("adds an actual D9 page and birth-date numerology for the advanced package", () => {
    const pages = buildReportContent({ locale: "en", packageType: "basic_plus", facts, narrative });
    expect(pages.some(page => page.chart === "d9")).toBe(true);
    const numerology = pages.find(page => page.title === "Life path and birth number")!;
    expect(numerology.body).toContain("2 + 0 + 0 + 0 + 0 + 1 + 0 + 1 = 4 → 4");
    expect(numerology.body).toContain("1 → 1");
  });
});
