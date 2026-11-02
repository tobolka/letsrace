import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { load } from "cheerio";
const checks = [];
for (const [slug, expected] of [
  ["jbc-4x-revelations-2027", "elite"],
  ["road-stage-orlicke-hory-2027", "distance"],
  ["prazsky-mtb-pohar-3-kolo-letnany-kbely-xco-2027", "round"],
]) {
  const url = `https://letsrace.cz/cs/zavod/${slug}`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const $ = load(await response.text());
  const schema = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text())).find(s => s["@type"] === "SportsEvent");
  $("script").remove();
  // React streams later sections beside the initial article; inspect the complete response.
  const text = $("body").text();
  assert(!text.includes("2008 a starší"), "An assumed Elite birth year is still displayed");
  assert(!/Slunce \d|m n\. m\./.test(text), "Removed day facts still appear");
  if (expected === "elite") assert.equal(schema.typicalAgeRange, undefined);
  if (expected === "distance") assert(text.includes("Vzdálenosti 69–138 km"));
  if (expected === "round") assert(text.includes("3. kolo · 4 v kalendáři"));
  checks.push({ url, status: response.status, expected, passed: true, snippet: expected === "round" ? "3. kolo · 4 v kalendáři" : expected === "distance" ? "Vzdálenosti 69–138 km" : "Elite without an inferred age limit" });
}
const url = "https://letsrace.cz/api/weather?lat=50.71&lng=15.16&date=2026-11-07&v=3";
const response = await fetch(url);
assert.equal(response.status, 200);
const weather = await response.json();
assert.equal(weather.elevation, undefined);
if (weather.forecast) assert(weather.forecastFetchedAt);
checks.push({ url, status: response.status, forecastAvailable: Boolean(weather.forecast), source: weather.forecast?.source ?? null, fetchedAt: weather.forecastFetchedAt ?? null, noElevation: true });
await writeFile(new URL("./live-checks.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
