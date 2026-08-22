import { describe, expect, it, vi } from "vitest";
import { resolveBirthLocation } from "./report-geocoding";
import { validateNarrativeDraft } from "./report-narrative";

vi.mock("./_core/map", () => ({
  makeRequest: vi.fn()
}));
import { makeRequest } from "./_core/map";

const facts = { chart: { ascendant: { sign: "Aries", degree: 12.5 }, planets: [{ name: "Sun", sign: "Leo" }] }, dasha: { system: "vimshottari" } };
const validDraft = { schemaVersion: "vedic-narrative.v1", locale: "en", sections: [{ sectionKey: "core-themes", title: "Core themes", paragraphs: ["The ascendant is a symbolic starting point for reflection."], factRefs: ["chart.ascendant.sign"], warnings: [] }], disclaimerKey: "interpretive-practice", modelVersion: "gpt-5-mini", promptVersion: "report-narrative-v1" } as const;

describe("Report Studio automation contracts", () => {
  it("resolves city coordinates and refines the IANA timezone at the birth instant", async () => {
    vi.mocked(makeRequest).mockResolvedValueOnce({ status: "OK", results: [{ formatted_address: "Berlin, Germany", geometry: { location: { lat: 52.52, lng: 13.405 }, location_type: "GEOMETRIC_CENTER" } }] }).mockResolvedValueOnce({ status: "OK", timeZoneId: "Europe/Berlin", rawOffset: 3600, dstOffset: 3600 }).mockResolvedValueOnce({ status: "OK", timeZoneId: "Europe/Berlin", rawOffset: 3600, dstOffset: 3600 });
    const resolved = await resolveBirthLocation({ city: "Berlin", country: "Germany", birthDate: "1990-06-01", birthTime: "12:00" });
    expect(resolved).toMatchObject({ latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin", timeZoneOffsetMinutes: 120, source: "google-maps-proxy" });
    expect(makeRequest).toHaveBeenCalledTimes(3);
  });

  it("accepts only narrative fact references that exist in the validated facts JSON", () => {
    expect(validateNarrativeDraft(validDraft, facts).schemaVersion).toBe("vedic-narrative.v1");
    expect(() => validateNarrativeDraft({ ...validDraft, sections: [{ ...validDraft.sections[0], factRefs: ["chart.missing"] }] }, facts)).toThrow(/missing fact/i);
    expect(() => validateNarrativeDraft({ ...validDraft, sections: [{ ...validDraft.sections[0], paragraphs: ["This will cure a medical condition."] }] }, facts)).toThrow(/prohibited/i);
  });
});
