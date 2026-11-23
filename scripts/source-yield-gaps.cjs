/**
 * From the weekly calendar audit (audit-source-yield.ts) to races worth a look.
 *
 *   node scripts/source-yield-gaps.cjs --yield=FILE --out=FILE [--urls=FILE] [--max=20]
 *
 * The audit lists every race a calendar offers that the server does not hold by that calendar's own id.
 * Most are not gaps: the same race is held under another source, or it is a triathlon, a brevet or a course
 * the catalogue does not cover. What is left, held nowhere in the Mac's copy either, is written to --out, and
 * the addresses of those race pages to --urls, which the discovery step reads as sources to look at. Nothing
 * is published here: discovery reads the page and the usual checks decide.
 */
const { readFileSync, writeFileSync, renameSync } = require('node:fs');
const { psql } = require('./local-sync.cjs');

const NOT_COVERED = /triathl|duathl|aquathl|brevet|\bRTF\b|laufen|\blauf\b|\brun\b|marsch|wander|\bkurs\b|training|fahrtechnik|skating|schwimm|\bswim|crossfit|radwandern|fahrradtour/i;
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
const tokens = text => new Set(fold(text).split(/\s+/).filter(word => word.length >= 3 && !/^20\d\d$/.test(word)));
const dayShift = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The same race by another listing: a day apart at most, most of the shorter name's words shared. */
function heldNearby(name, date, byDay) {
  const own = tokens(name);
  if (!own.size) return false;
  for (const shift of [-1, 0, 1]) {
    for (const other of byDay.get(dayShift(date, shift)) ?? []) {
      const theirs = tokens(other);
      if (!theirs.size) continue;
      let shared = 0;
      for (const word of own) if (theirs.has(word)) shared++;
      if (shared / Math.min(own.size, theirs.size) >= 0.6) return true;
    }
  }
  return false;
}

/** @param {{url:string,missing:{name:string,date:string,sourceUrl?:string,countryHint?:string}[]}[]} checked @param {Map<string,string[]>} byDay */
function gaps(checked, byDay) {
  const seen = new Set(), out = [], dropped = { held_nearby: 0, not_covered: 0 };
  for (const source of checked) {
    for (const item of source.missing ?? []) {
      const key = `${item.name}|${item.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (NOT_COVERED.test(item.name)) { dropped.not_covered++; continue; }
      if (heldNearby(item.name, item.date, byDay)) { dropped.held_nearby++; continue; }
      out.push({ name: item.name, date: item.date, country: item.countryHint ?? null, source: source.url, url: item.sourceUrl ?? null });
    }
  }
  return { gaps: out, dropped };
}

function main() {
  const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const input = JSON.parse(readFileSync(arg('yield'), 'utf8'));
  const rows = JSON.parse(psql('letsrace', "select coalesce(json_agg(json_build_object('n', name, 'd', start_date)), '[]') from public.events where start_date >= current_date - 1"));
  const byDay = new Map();
  for (const row of rows) byDay.set(row.d, [...(byDay.get(row.d) ?? []), row.n]);
  const { gaps: found, dropped } = gaps(input.checked ?? [], byDay);
  const max = Number(arg('max') ?? 60);
  const urls = [...new Set(found.map(gap => gap.url).filter(url => /^https:\/\//.test(url ?? '')))].slice(0, max);
  const write = (file, value) => { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(value, null, 2)); renameSync(tmp, file); };
  write(arg('out'), { at: new Date().toISOString(), auditAt: input.checkedAt, gaps: found, dropped });
  if (arg('urls')) write(arg('urls'), urls);
  console.log(`source_yield_gaps ${JSON.stringify({ gaps: found.length, queued: urls.length, ...dropped })}`);
}

if (require.main === module) main();
module.exports = { gaps, heldNearby, NOT_COVERED };
