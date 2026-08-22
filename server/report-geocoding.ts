import { makeRequest, type GeocodingResult, type TimeZoneResult } from "./_core/map";

export type ResolvedBirthLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  timeZoneOffsetMinutes: number;
  formattedAddress: string;
  locationType: string;
  source: "google-maps-proxy";
  qualityFlags: string[];
};

function parseLocalAsUtc(date: string, time: string) {
  const value = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(value.getTime())) throw new Error("Invalid local birth date or time.");
  return value;
}

function assertCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Geocoder returned invalid coordinates.");
}

export async function resolveBirthLocation(input: { city: string; country: string; birthDate: string; birthTime: string }): Promise<ResolvedBirthLocation> {
  const address = `${input.city.trim()}, ${input.country.trim()}`;
  const geocode = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address });
  if (geocode.status !== "OK" || !geocode.results[0]) throw new Error(`City could not be resolved (${geocode.status}).`);
  const match = geocode.results[0];
  const latitude = match.geometry.location.lat;
  const longitude = match.geometry.location.lng;
  assertCoordinates(latitude, longitude);
  const initial = parseLocalAsUtc(input.birthDate, input.birthTime);
  const timezoneFor = (timestamp: Date) => makeRequest<TimeZoneResult>("/maps/api/timezone/json", { location: `${latitude},${longitude}`, timestamp: Math.floor(timestamp.getTime() / 1000) });
  const firstZone = await timezoneFor(initial);
  if (firstZone.status !== "OK" || !firstZone.timeZoneId) throw new Error(`Timezone could not be resolved (${firstZone.status}).`);
  const refinedInstant = new Date(initial.getTime() - (firstZone.rawOffset + firstZone.dstOffset));
  const refinedZone = await timezoneFor(refinedInstant);
  const zone = refinedZone.status === "OK" && refinedZone.timeZoneId ? refinedZone : firstZone;
  const qualityFlags: string[] = [];
  if (!["ROOFTOP", "GEOMETRIC_CENTER"].includes(match.geometry.location_type)) qualityFlags.push("low_confidence_geocode");
  if (refinedZone.status !== "OK") qualityFlags.push("timezone_refinement_failed");
  return { latitude, longitude, timezone: zone.timeZoneId, timeZoneOffsetMinutes: Math.round((zone.rawOffset + zone.dstOffset) / 60), formattedAddress: match.formatted_address, locationType: match.geometry.location_type, source: "google-maps-proxy", qualityFlags };
}
