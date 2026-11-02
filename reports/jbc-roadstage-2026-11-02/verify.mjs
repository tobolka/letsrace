import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { load } from "cheerio";
const ids = ["4a99a311-023a-4b88-8a78-ad8e954eb926", "26c164f6-fd6a-4be5-83ca-fa7ed9f4ce3b"];
const checks = [];
for (const [path, expected] of [
  ["/api/events?catalogue=1", ids],
  ["/api/events?q=JBC&season=2027&disciplines=four_cross&country=CZ&anyDate=1", [ids[0]]],
  ["/api/events?q=JBC&season=2027&disciplines=mtb&country=CZ&anyDate=1", [ids[0]]],
  ["/api/events?q=RoadStage&season=2027&anyDate=1&west=16.34&east=16.36&south=50.30&north=50.31", [ids[1]]],
]) {
  const response = await fetch(`https://letsrace.cz${path}`);
  assert.equal(response.status, 200);
  const events = await response.json();
  const rows = events.filter(e => ids.includes(e.id));
  assert.deepEqual(rows.map(e => e.id).sort(), [...expected].sort());
  for (const e of rows) {
    assert(!e.location.name.includes("Kikirikiii"));
    assert.equal(e.location.lat, e.id === ids[0] ? 50.70933 : 50.304743);
    assert.equal(e.location.lng, e.id === ids[0] ? 15.1610825 : 16.350751);
  }
  checks.push({ path, status: response.status, total: events.length, rows });
}
for (const [i, slug] of ["jbc-4x-revelations-2027", "road-stage-orlicke-hory-2027"].entries()) {
  for (const [locale, section] of [["cs", "zavod"], ["en", "race"]]) {
    const path = `/${locale}/${section}/${slug}`;
    const response = await fetch(`https://letsrace.cz${path}`);
    assert.equal(response.status, 200);
    const $ = load(await response.text());
    const schema = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).text())).find(s => s["@type"] === "SportsEvent");
    assert.equal(schema.startDate, i === 0 ? "2027-07-09" : "2027-06-05");
    assert.equal(schema.location.geo.latitude, i === 0 ? 50.70933 : 50.304743);
    assert.equal($('article[data-race-id]').attr("data-race-id"), ids[i]);
    if (i === 1) assert($('a[href="https://registrace.sportsoft.cz/registration.aspx?e=3630"]').length > 0);
    checks.push({ path, status: response.status, id: ids[i], revision: $('article[data-race-id]').attr("data-race-revision"), schema });
  }
}
await writeFile(new URL("./public-checks.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
console.log(`${checks.length} public checks passed`);
