import { calculateVedicSnapshot } from "../server/vedic-astrology-calculator.ts";

const snapshot = calculateVedicSnapshot({
  localDate: "1990-01-01",
  localTime: "12:00:00",
  timeZoneOffsetMinutes: 0,
  latitude: 55.7558,
  longitude: 37.6173,
});

console.log(JSON.stringify({
  contractVersion: snapshot.contractVersion,
  utcIso: snapshot.input.utcIso,
  ascendant: snapshot.ascendant,
  moon: snapshot.planets.find((p) => p.planet === "Moon"),
  d9Moon: snapshot.d9.find((p) => p.planet === "Moon"),
  firstDasha: snapshot.vimshottari.periods[0],
}, null, 2));
