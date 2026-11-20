/**
 * Which changes of a date or a cancellation could go to the server, and which cannot yet. A look only:
 * nothing is sent, nothing is written but the report.
 *
 *   node scripts/date-proposals.cjs [--out=FILE]
 *
 * A change qualifies when the Mac's copy differs from its untouched twin in start_date, end_date or status
 * only, the race is in the future, and a fact written with the change quotes the page it came from
 * (see provenChange in local-sync.cjs). The rules a sender would add are checked here too, so the numbers
 * are what a sender would really get: a date no more than a year from the old one, never into the past.
 */
const { writeFileSync, renameSync } = require('node:fs');
const { psql, proofFor } = require('./local-sync.cjs');

const DECISIVE = ['start_date', 'end_date', 'status'];
const OTHER = ['name', 'merged_into_id'];
const MAX_SHIFT_DAYS = 365;
const DAY = 86_400_000;
const day = value => (value == null ? null : String(value).slice(0, 10));

/**
 * @param {object[]} work   races in the working copy: id, name, start_date, end_date, status, merged_into_id
 * @param {object[]} base   the same races in the untouched twin
 * @param {object[]} facts  event_facts of the changed races
 */
function classify(work, base, facts, today = new Date().toISOString().slice(0, 10)) {
  const before = new Map(base.map(row => [row.id, row]));
  const factsOf = new Map();
  for (const fact of facts) { const list = factsOf.get(fact.event_id) ?? []; list.push(fact); factsOf.set(fact.event_id, list); }
  const ready = [], waiting = [], reasons = {};
  const why = (race, reason, extra = {}) => { reasons[reason] = (reasons[reason] ?? 0) + 1; waiting.push({ id: race.id, name: race.name, reason, ...extra }); };
  for (const race of work) {
    const old = before.get(race.id);
    if (!old) continue;
    const norm = (row, column) => (column === 'status' ? row.status : day(row[column]));
    const changed = DECISIVE.filter(column => norm(race, column) !== norm(old, column));
    if (!changed.length) continue;
    if (OTHER.some(column => (race[column] ?? null) !== (old[column] ?? null))) { why(race, 'name_or_merge_also_changed'); continue; }
    const after = Object.fromEntries(changed.map(column => [column, norm(race, column)]));
    const prior = Object.fromEntries(changed.map(column => [column, norm(old, column)]));
    if (day(race.start_date) < today) { why(race, 'date_in_the_past', { after }); continue; }
    if (changed.includes('status') && after.status !== 'cancelled') { why(race, 'status_needs_a_person', { after }); continue; }
    const far = ['start_date', 'end_date'].find(column => changed.includes(column) && prior[column] && Math.abs(Date.parse(after[column]) - Date.parse(prior[column])) > MAX_SHIFT_DAYS * DAY);
    if (far) { why(race, 'moved_more_than_a_year', { after, before: prior }); continue; }
    // A moved end date with no end before it is a date filled in, not moved; it still needs its quote.
    const find = proofFor({ after }, factsOf.get(race.id) ?? []);
    const proofs = Object.fromEntries(changed.map(column => [column, find(column)]));
    const missing = changed.filter(column => !proofs[column]);
    if (missing.length) { why(race, 'no_quote_for_' + missing.join('_'), { after, before: prior }); continue; }
    ready.push({ id: race.id, name: race.name, before: prior, after, proofs: Object.fromEntries(changed.map(column => [column, { quote: proofs[column].quote, source_url: proofs[column].source_url, method: proofs[column].method }])) });
  }
  return { ready, waiting, reasons };
}

/** Source-evidence reads as the per-date facts provenChange looks for. */
function evidenceFacts(reads) {
  const out = [];
  for (const { event_id, event } of reads) {
    const evidence = event?.evidence;
    if (!evidence?.quote || !event.startDate) continue;
    const base = { event_id, quote: evidence.quote, source_url: evidence.sourceUrl ?? event.sourceUrl, method: evidence.method ?? 'source_evidence' };
    out.push({ ...base, field: 'start_date', value: event.startDate });
    // A single-day race has no end of its own: its end is its start.
    out.push({ ...base, field: 'end_date', value: event.endDate ?? event.startDate });
  }
  return out;
}

function load(database) {
  const text = psql(database, `select coalesce(json_agg(json_build_object('id', id, 'name', name, 'start_date', start_date, 'end_date', end_date, 'status', status, 'merged_into_id', merged_into_id)), '[]') from public.events where end_date >= current_date - 2 or start_date >= current_date - 2`);
  return JSON.parse(text);
}

function main() {
  const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
  const work = load('letsrace'), base = load('letsrace_baseline');
  const baseById = new Map(base.map(row => [row.id, row]));
  const changedIds = work.filter(race => { const old = baseById.get(race.id); return old && (day(race.start_date) !== day(old.start_date) || day(race.end_date) !== day(old.end_date) || race.status !== old.status); }).map(race => race.id);
  const facts = changedIds.length ? JSON.parse(psql('letsrace', `select coalesce(json_agg(json_build_object('event_id', event_id, 'field', field, 'value', value #>> '{}', 'quote', quote, 'source_url', source_url, 'method', method)), '[]') from public.event_facts where field in ('start_date', 'end_date', 'status') and event_id in (${changedIds.map(id => `'${id}'::uuid`).join(',')})`)) : [];
  // A read that kept the page words its dates stood in (date-evidence.ts) proves them, even when the race changed
  // earlier and so wrote no fact of its own: its source evidence names the start, and the end when it has one.
  if (changedIds.length) {
    const reads = JSON.parse(psql('letsrace', `select coalesce(json_agg(json_build_object('event_id', event_id, 'event', value->'event')), '[]') from public.event_facts where field = 'source_evidence' and value->'event'->'evidence'->>'quote' is not null and event_id in (${changedIds.map(id => `'${id}'::uuid`).join(',')})`));
    facts.push(...evidenceFacts(reads));
  }
  const result = classify(work, base, facts);
  const summary = { at: new Date().toISOString(), changed: result.ready.length + result.waiting.length, ready: result.ready.length, waiting: result.waiting.length, reasons: result.reasons, ready_sample: result.ready.slice(0, 20), dry: true };
  if (out) { const tmp = `${out}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify({ ...summary, ready_all: result.ready, waiting_all: result.waiting }, null, 2)); renameSync(tmp, out); }
  console.log(`date_proposals ${JSON.stringify({ changed: summary.changed, ready: summary.ready, waiting: summary.waiting, reasons: summary.reasons })}`);
}

if (require.main === module) main();
module.exports = { classify, evidenceFacts };
