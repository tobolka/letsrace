/**
 * Where the regulations of this year's edition and the race's own record disagree. A look only.
 *
 *   node scripts/regulation-disagreements.cjs [--out=FILE]
 *
 * Regulations of the current edition rank above the calendars, so a disagreement is worth a person's or the
 * agent's look. Three checks, on races that have the field read from regulations with its quote:
 *   place:    the town the regulations name is not the stored town (or the stored venue's name);
 *   country:  the regulations name another country than the stored place;
 *   dates:    a programme day lies outside the race's own days.
 * Most place differences are spelling or the start and the finish of a long route, not mistakes, which is why
 * nothing is changed here: the report says how many there are, and what they are.
 */
const { writeFileSync, renameSync } = require('node:fs');
const { psql } = require('./local-sync.cjs');

const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
// Same town in another language or at another grain: "Warszawa" and "Warsaw" share their start, "Praha 5 Motol" holds "Motol".
const sameTown = (a, b) => {
  const x = fold(a), y = fold(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x) || (x.length >= 4 && y.length >= 4 && x.slice(0, 4) === y.slice(0, 4));
};

/** @param {{id,name,start_date,end_date,municipality,place,country,venue_town,venue_name,venue_country,schedule_from,schedule_to}[]} rows */
function classify(rows) {
  const out = { place: [], country: [], dates: [] };
  for (const row of rows) {
    if (row.venue_country && row.country && row.venue_country !== row.country) out.country.push(row);
    else if (row.venue_town && !sameTown(row.venue_town, row.municipality) && !sameTown(row.venue_town, row.place)) out.place.push(row);
    const last = row.end_date ?? row.start_date;
    if (row.schedule_from && (row.schedule_from < row.start_date || row.schedule_to > last)) out.dates.push(row);
  }
  return out;
}

function main() {
  const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
  const rows = JSON.parse(psql('letsrace', `select coalesce(json_agg(t), '[]') from (
    select e.id, e.name, e.start_date::text, e.end_date::text, l.municipality, l.name place, l.country_code country,
      e.practical_details->'venue'->'value'->>'locality' venue_town, e.practical_details->'venue'->'value'->>'name' venue_name, e.practical_details->'venue'->'value'->>'countryCode' venue_country,
      (select min(i->>'date') from jsonb_array_elements(case when e.practical_details->'schedule'->>'status' = 'current' and (e.practical_details->'schedule'->>'editionYear')::int = extract(year from e.start_date) then e.practical_details->'schedule'->'value' else '[]'::jsonb end) i where i->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}$') schedule_from,
      (select max(i->>'date') from jsonb_array_elements(case when e.practical_details->'schedule'->>'status' = 'current' and (e.practical_details->'schedule'->>'editionYear')::int = extract(year from e.start_date) then e.practical_details->'schedule'->'value' else '[]'::jsonb end) i where i->>'date' ~ '^\\d{4}-\\d{2}-\\d{2}$') schedule_to
    from public.events e left join public.locations l on l.id = e.location_id
    where e.visibility = 'public' and e.merged_into_id is null and e.start_date >= current_date
      and ((e.practical_details->'venue'->>'status' = 'current' and (e.practical_details->'venue'->>'editionYear')::int = extract(year from e.start_date))
        or (e.practical_details->'schedule'->>'status' = 'current' and (e.practical_details->'schedule'->>'editionYear')::int = extract(year from e.start_date)))
  ) t`));
  const found = classify(rows);
  const summary = { at: new Date().toISOString(), checked: rows.length, place: found.place.length, country: found.country.length, dates: found.dates.length };
  if (out) { const tmp = `${out}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify({ ...summary, details: found }, null, 2)); renameSync(tmp, out); }
  console.log(`regulation_disagreements ${JSON.stringify(summary)}`);
}

if (require.main === module) main();
module.exports = { classify, sameTown };
