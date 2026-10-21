import { afterEach, describe, expect, it, vi } from "vitest";
import { findOfflineBirthCity } from "./geonames-location";
import { resolveBirthLocation } from "./report-geocoding";
afterEach(() => vi.unstubAllEnvs());
describe("offline birth city resolution", () => {
  it("resolves translated city and country names to a consistent location", () => {
    expect(findOfflineBirthCity("Москва", "Россия")).toMatchObject({ country: "RU", timezone: "Europe/Moscow" });
    expect(findOfflineBirthCity("Moscow", "RU").geonameId).toBe(findOfflineBirthCity("Москва", "Россия").geonameId);
    expect(findOfflineBirthCity("Berlin", "Deutschland")).toMatchObject({ country: "DE", timezone: "Europe/Berlin" });
  });
  it("rejects unknown cities and ambiguous country input", () => {
    expect(() => findOfflineBirthCity("not-a-real-city", "DE")).toThrow("outside");
    expect(() => findOfflineBirthCity("Berlin", "not-a-country")).toThrow("Country");
  });
  it("uses historical timezone rules and rejects DST gaps before payment", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "geonames");
    await expect(resolveBirthLocation({ city: "Berlin", country: "DE", birthDate: "1990-06-01", birthTime: "12:00" })).resolves.toMatchObject({ source: "geonames-offline", timeZoneOffsetMinutes: 120 });
    await expect(resolveBirthLocation({ city: "Berlin", country: "DE", birthDate: "2026-03-29", birthTime: "02:30" })).rejects.toThrow("gap");
  });
});
