/**
 * Add/refresh ISO country codes without changing city names, order or positions.
 * Source: https://download.geonames.org/export/dump/cities15000.zip (CC BY 4.0).
 * Unzip first, then: node scripts/annotate-map-cities.mjs /path/to/cities15000.txt
 */
import { readFileSync, writeFileSync } from "node:fs";

if (!process.argv[2]) throw new Error("Pass the extracted GeoNames cities15000.txt path");
const asset = new URL("../public/maps/light-v1/cities.json", import.meta.url);
const key = (lat, lng) => `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
const countries = new Map();
for (const line of readFileSync(process.argv[2], "utf8").split("\n")) {
  if (!line.trim()) continue;
  const row = line.split("\t");
  const position = key(row[4], row[5]);
  const previous = countries.get(position);
  if (previous && previous !== row[8]) throw new Error(`Ambiguous country at ${position}`);
  countries.set(position, row[8]);
}
const cities = JSON.parse(readFileSync(asset, "utf8")).map((city) => {
  const country = countries.get(key(city[1], city[2]));
  if (!country || !/^[A-Z]{2}$/.test(country)) throw new Error(`Missing country for ${city[0]}`);
  return [...city.slice(0, 5), country];
});
writeFileSync(asset, JSON.stringify(cities));
console.log(`Annotated ${cities.length} map cities with GeoNames country codes`);
