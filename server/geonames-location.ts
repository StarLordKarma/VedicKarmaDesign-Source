import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

type City = [number, string, string, number, number, string, string[]];
const normalize = (value: string) => value.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toLocaleLowerCase("en").replace(new RegExp("[^\\p{L}\\p{N}]", "gu"), "");
let index: Map<string, City[]> | undefined;
let countries: Map<string, Set<string>>;
function load() {
  if (index) return;
  const cities: City[] = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), "server/data/geonames-cities15000.json.gz"))).toString("utf8"));
  index = new Map(); countries = new Map();
  for (const code of Array.from(new Set(cities.map(city => city[2])))) {
    const names = [code, ...["en", "ru", "de", "es"].map(locale => new Intl.DisplayNames([locale], { type: "region" }).of(code) || code)];
    if (code === "US") names.push("USA", "United States of America", "США");
    if (code === "GB") names.push("UK", "Great Britain", "Великобритания");
    for (const name of names) { const key = normalize(name); const codes = countries.get(key) || new Set(); codes.add(code); countries.set(key, codes); }
  }
  for (const city of cities) for (const alias of Array.from(new Set(city[6].filter(Boolean).map(normalize)))) {
    const key = `${city[2]}:${alias}`; const matches = index.get(key) || []; matches.push(city); index.set(key, matches);
  }
}

export function findOfflineBirthCity(cityName: string, countryName: string) {
  load();
  const codes = countries.get(normalize(countryName));
  if (!codes || codes.size !== 1) throw new Error("Country is not recognized. Use its full name or two-letter ISO code.");
  const code = Array.from(codes)[0];
  const matches = index!.get(`${code}:${normalize(cityName)}`) || [];
  if (matches.length !== 1) throw new Error(matches.length ? "Birth city is ambiguous. Contact support before payment." : "Birth city is outside the supported city directory. Contact support before payment.");
  const [geonameId, name, country, latitude, longitude, timezone] = matches[0];
  return { geonameId, name, country, latitude, longitude, timezone };
}
