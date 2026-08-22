import { describe, expect, it } from "vitest";
import { calculateVedicSnapshot, __calculationInternals } from "./vedic-astrology-calculator";

describe("VedicAstrologyCalculator", () => {
  const moscowBirth = {
    localDate: "1990-01-01",
    localTime: "15:00:00",
    timeZoneOffsetMinutes: 180,
    latitude: 55.7558,
    longitude: 37.6173,
  } as const;

  it("normalizes local time to UTC and produces a stable Lahiri contract", () => {
    const snapshot = calculateVedicSnapshot(moscowBirth);
    expect(snapshot.contractVersion).toBe("vedic-report-calculation/v1");
    expect(snapshot.engine.ayanamsa).toBe("lahiri");
    expect(snapshot.engine.zodiac).toBe("sidereal");
    expect(snapshot.input.utcIso).toBe("1990-01-01T12:00:00.000Z");
    expect(snapshot.input.julianDayUt).toBeCloseTo(2447893, 0);
    expect(snapshot.planets).toHaveLength(9);
    expect(snapshot.ascendant.longitude).toBeCloseTo(64.479244, 5);
    expect(snapshot.planets.find((planet) => planet.planet === "Moon")?.longitude).toBeCloseTo(309.547025, 5);
  });

  it("creates D1 and D9 placements for all planets plus ascendant", () => {
    const snapshot = calculateVedicSnapshot(moscowBirth);
    expect(snapshot.d1).toHaveLength(10);
    expect(snapshot.d9).toHaveLength(10);
    expect(snapshot.d1.every((placement) => placement.sign >= 0 && placement.sign <= 11)).toBe(true);
    expect(snapshot.d9.every((placement) => placement.sign >= 0 && placement.sign <= 11)).toBe(true);
    expect(snapshot.d9.find((placement) => placement.planet === "Moon")?.sign).toBe(8);
  });

  it("builds Vimshottari periods from the Moon nakshatra with a birth balance", () => {
    const snapshot = calculateVedicSnapshot(moscowBirth);
    const periods = snapshot.vimshottari.periods;
    expect(snapshot.vimshottari.birthLord).toBe("Rahu");
    expect(periods).toHaveLength(9);
    expect(periods[0].isBirthBalance).toBe(true);
    expect(periods[0].lord).toBe("Rahu");
    expect(new Date(periods[0].startUtc).toISOString()).toBe(snapshot.input.utcIso);
    expect(new Date(periods[0].endUtc).getTime()).toBeGreaterThan(new Date(periods[0].startUtc).getTime());
    expect(periods.slice(1).every((period) => !period.isBirthBalance)).toBe(true);
  });

  it("keeps the pure D9 and degree helpers deterministic", () => {
    expect(__calculationInternals.normalizeDegrees(-1)).toBe(359);
    expect(__calculationInternals.makeDivisionalPlacement("Sun", 0, 9)).toMatchObject({ sign: 0, degreeInSign: 0 });
    expect(__calculationInternals.makeDivisionalPlacement("Sun", 30, 9)).toMatchObject({ sign: 9, degreeInSign: 0 });
    expect(__calculationInternals.makeDivisionalPlacement("Sun", 60, 9)).toMatchObject({ sign: 6, degreeInSign: 0 });
  });

  it.each([
    { latitude: 91, longitude: 0, timeZoneOffsetMinutes: 0 },
    { latitude: 0, longitude: 181, timeZoneOffsetMinutes: 0 },
    { latitude: 0, longitude: 0, timeZoneOffsetMinutes: 900 },
  ])("rejects invalid geographic or timezone input %#", (override) => {
    expect(() => calculateVedicSnapshot({ ...moscowBirth, ...override })).toThrow();
  });
});
