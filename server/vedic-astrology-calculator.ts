import {
  calc_ut,
  constants,
  houses_ex2,
  set_ephe_path,
  set_sid_mode,
  utc_to_jd,
} from "sweph";

export type SupportedPlanet =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Rahu"
  | "Ketu";
export type ChartPoint = SupportedPlanet | "Ascendant";

export interface BirthInput {
  localDate: string;
  localTime: string;
  timeZoneOffsetMinutes: number;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

export interface PlanetaryPosition {
  planet: SupportedPlanet;
  longitude: number;
  latitude: number;
  distanceAu: number;
  speedLongitude: number;
  sign: number;
  degreeInSign: number;
  nakshatra: number;
  pada: number;
  retrograde: boolean;
}

export interface DivisionalPlacement {
  planet: ChartPoint;
  longitude: number;
  sign: number;
  degreeInSign: number;
}

export interface VimshottariPeriod {
  lord: SupportedPlanet;
  startUtc: string;
  endUtc: string;
  durationDays: number;
  isBirthBalance: boolean;
}

export interface CalculationSnapshot {
  contractVersion: "vedic-report-calculation/v1";
  engine: {
    adapter: "sweph";
    engineVersion: string;
    zodiac: "sidereal";
    ayanamsa: "lahiri";
    ephemerisMode: "moseph" | "sweph";
    houseMethod: "whole-sign";
  };
  input: BirthInput & { utcIso: string; julianDayUt: number };
  ascendant: { longitude: number; sign: number; degreeInSign: number };
  planets: PlanetaryPosition[];
  d1: DivisionalPlacement[];
  d9: DivisionalPlacement[];
  vimshottari: { birthLord: SupportedPlanet; periods: VimshottariPeriod[] };
}

const PLANETS: Array<[SupportedPlanet, number]> = [
  ["Sun", constants.SE_SUN],
  ["Moon", constants.SE_MOON],
  ["Mercury", constants.SE_MERCURY],
  ["Venus", constants.SE_VENUS],
  ["Mars", constants.SE_MARS],
  ["Jupiter", constants.SE_JUPITER],
  ["Saturn", constants.SE_SATURN],
  ["Rahu", constants.SE_MEAN_NODE],
];

const VIMSHOTTARI_ORDER: SupportedPlanet[] = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];

const VIMSHOTTARI_YEARS: Record<SupportedPlanet, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const NAKSHATRA_SPAN = 360 / 27;
const PADA_SPAN = NAKSHATRA_SPAN / 4;
const DAY_MS = 86_400_000;
const VIMSHOTTARI_TOTAL_YEARS = 120;

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function signOf(longitude: number): number {
  return Math.floor(normalizeDegrees(longitude) / 30);
}

function degreeInSign(longitude: number): number {
  return normalizeDegrees(longitude) % 30;
}

function toUtcDate(input: BirthInput): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate)) throw new Error("localDate must use YYYY-MM-DD");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.localTime)) throw new Error("localTime must use HH:mm or HH:mm:ss");
  const [year, month, day] = input.localDate.split("-").map(Number);
  const [hour, minute, second = 0] = input.localTime.split(":").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - input.timeZoneOffsetMinutes * 60_000);
  if (Number.isNaN(utc.getTime())) throw new Error("Invalid birth date/time");
  return utc;
}

function validateInput(input: BirthInput): void {
  assertFinite("timeZoneOffsetMinutes", input.timeZoneOffsetMinutes);
  assertFinite("latitude", input.latitude);
  assertFinite("longitude", input.longitude);
  if (input.latitude < -90 || input.latitude > 90) throw new Error("latitude must be between -90 and 90");
  if (input.longitude < -180 || input.longitude > 180) throw new Error("longitude must be between -180 and 180");
  if (input.timeZoneOffsetMinutes < -14 * 60 || input.timeZoneOffsetMinutes > 14 * 60) {
    throw new Error("timeZoneOffsetMinutes is outside the supported timezone range");
  }
}

function makeDivisionalPlacement(planet: ChartPoint, longitude: number, division: 1 | 9): DivisionalPlacement {
  const normalized = normalizeDegrees(longitude);
  if (division === 1) return { planet, longitude: normalized, sign: signOf(normalized), degreeInSign: degreeInSign(normalized) };

  const rasi = signOf(normalized);
  const withinRasi = degreeInSign(normalized);
  const navamsaIndex = Math.min(8, Math.floor(withinRasi / (30 / 9)));
  const movable = [0, 3, 6, 9].includes(rasi);
  const fixed = [1, 4, 7, 10].includes(rasi);
  const startSign = movable ? rasi : fixed ? (rasi + 8) % 12 : (rasi + 4) % 12;
  const d9Sign = (startSign + navamsaIndex) % 12;
  return {
    planet,
    longitude: normalizeDegrees(d9Sign * 30 + (withinRasi % (30 / 9)) * 9),
    sign: d9Sign,
    degreeInSign: (withinRasi % (30 / 9)) * 9,
  };
}

function makeVimshottari(moonLongitude: number, birthUtc: Date): { birthLord: SupportedPlanet; periods: VimshottariPeriod[] } {
  const moon = normalizeDegrees(moonLongitude);
  const nakshatra = Math.floor(moon / NAKSHATRA_SPAN);
  const birthLord = VIMSHOTTARI_ORDER[nakshatra % 9];
  const withinNakshatra = moon - nakshatra * NAKSHATRA_SPAN;
  const elapsedFraction = withinNakshatra / NAKSHATRA_SPAN;
  const balanceDays = VIMSHOTTARI_YEARS[birthLord] * (1 - elapsedFraction) * 365.2425;
  const periods: VimshottariPeriod[] = [];
  let cursor = birthUtc.getTime();
  const firstIndex = VIMSHOTTARI_ORDER.indexOf(birthLord);

  for (let i = 0; i < 9; i += 1) {
    const lord = VIMSHOTTARI_ORDER[(firstIndex + i) % 9];
    const durationDays = i === 0 ? balanceDays : VIMSHOTTARI_YEARS[lord] * 365.2425;
    const end = cursor + durationDays * DAY_MS;
    periods.push({
      lord,
      startUtc: new Date(cursor).toISOString(),
      endUtc: new Date(end).toISOString(),
      durationDays,
      isBirthBalance: i === 0,
    });
    cursor = end;
  }
  return { birthLord, periods };
}

function readCalc(planet: SupportedPlanet, id: number, jdUt: number, flags: number): PlanetaryPosition {
  const result = calc_ut(jdUt, id, flags);
  if (result.flag < 0 || !result.data) throw new Error(`Swiss Ephemeris failed for ${planet}: ${result.error ?? "unknown error"}`);
  const [longitude, latitude, distanceAu, speedLongitude] = result.data;
  const normalized = normalizeDegrees(longitude);
  return {
    planet,
    longitude: normalized,
    latitude,
    distanceAu,
    speedLongitude,
    sign: signOf(normalized),
    degreeInSign: degreeInSign(normalized),
    nakshatra: Math.floor(normalized / NAKSHATRA_SPAN),
    pada: Math.floor((normalized % NAKSHATRA_SPAN) / PADA_SPAN) + 1,
    retrograde: speedLongitude < 0,
  };
}

export function calculateVedicSnapshot(input: BirthInput): CalculationSnapshot {
  validateInput(input);
  const birthUtc = toUtcDate(input);
  const utc = utc_to_jd(
    birthUtc.getUTCFullYear(),
    birthUtc.getUTCMonth() + 1,
    birthUtc.getUTCDate(),
    birthUtc.getUTCHours() + birthUtc.getUTCMinutes() / 60 + birthUtc.getUTCSeconds() / 3600,
    0,
    0,
    constants.SE_GREG_CAL,
  );
  if (utc.flag !== constants.OK) throw new Error(`Swiss Ephemeris date conversion failed: ${utc.error ?? "unknown error"}`);
  const [, jdUt] = utc.data;
  set_sid_mode(constants.SE_SIDM_LAHIRI, 0, 0);
  if (process.env.SWE_EPHE_PATH) set_ephe_path(process.env.SWE_EPHE_PATH);

  const ephemerisMode = process.env.SWE_EPHE_PATH ? "sweph" : "moseph";
  const flags = (ephemerisMode === "sweph" ? constants.SEFLG_SWIEPH : constants.SEFLG_MOSEPH) | constants.SEFLG_SIDEREAL | constants.SEFLG_SPEED;
  const planets = PLANETS.map(([planet, id]) => readCalc(planet, id, jdUt, flags));
  const ketuLongitude = normalizeDegrees(planets.find((p) => p.planet === "Rahu")!.longitude + 180);
  planets.push({ ...planets.find((p) => p.planet === "Rahu")!, planet: "Ketu", longitude: ketuLongitude, sign: signOf(ketuLongitude), degreeInSign: degreeInSign(ketuLongitude), nakshatra: Math.floor(ketuLongitude / NAKSHATRA_SPAN), pada: Math.floor((ketuLongitude % NAKSHATRA_SPAN) / PADA_SPAN) + 1, retrograde: true });

  const houses = houses_ex2(jdUt, flags, input.latitude, input.longitude, "P");
  if (houses.flag < 0 || !houses.data) throw new Error(`Swiss Ephemeris houses failed: ${houses.error ?? "unknown error"}`);
  const ascLongitude = normalizeDegrees(houses.data.points[0]);
  const ascendant = { longitude: ascLongitude, sign: signOf(ascLongitude), degreeInSign: degreeInSign(ascLongitude) };
  const allPlacements: Array<{ planet: ChartPoint; longitude: number }> = [{ planet: "Ascendant", longitude: ascLongitude }, ...planets.map((p) => ({ planet: p.planet, longitude: p.longitude }))];

  return {
    contractVersion: "vedic-report-calculation/v1",
    engine: { adapter: "sweph", engineVersion: "2.10.3-5", zodiac: "sidereal", ayanamsa: "lahiri", ephemerisMode, houseMethod: "whole-sign" },
    input: { ...input, utcIso: birthUtc.toISOString(), julianDayUt: jdUt },
    ascendant,
    planets,
    d1: allPlacements.map(({ planet, longitude }) => makeDivisionalPlacement(planet, longitude, 1)),
    d9: allPlacements.map(({ planet, longitude }) => makeDivisionalPlacement(planet, longitude, 9)),
    vimshottari: makeVimshottari(planets.find((p) => p.planet === "Moon")!.longitude, birthUtc),
  };
}

export const __calculationInternals = { normalizeDegrees, makeDivisionalPlacement, makeVimshottari, toUtcDate, NAKSHATRA_SPAN, VIMSHOTTARI_TOTAL_YEARS };
