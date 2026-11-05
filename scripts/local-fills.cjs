/**
 * Details the Mac found for races already on the server, as a change set for local-sync.cjs.
 *
 * Only a field empty on the server, empty when the Mac's copy was taken (or a race the Mac
 * created after that), and filled on the Mac since. A value the server has since removed was not empty at that moment, so a bad link that
 * someone cleared cannot come back. Nothing here changes a value, a date, a name or a place.
 * The race's manual locks and the target's current values are checked again on arrival.
 */
const { createHash } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { psql } = require('./local-sync.cjs');

const EVENT_FIELDS = ['website_url', 'registration_url', 'regulations_url', 'results_url', 'class_label', 'competition_type', 'description', 'level', 'uci_class', 'formats', 'registration_opens_at', 'registration_closes_at', 'disciplines', 'practical_details'];
/** Categories are one fact: their companions move only with them. */
const AGE_FIELDS = ['age_categories', 'age_confidence', 'audience'];
const LOCATION_FIELDS = ['lat', 'lng', 'geog', 'geocode_query', 'geocode_status'];
const isEmpty = value => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The pure decision, for one race as held in the three places. */
function eventFills(work, base, target) {
  if (!work || !target || target.merged_into_id || work.merged_into_id) return null;
  // Not in the copy at all: the Mac itself created this race later, so nothing was there to remove.
  base ??= {};
  // Not the same edition any more, so nothing the Mac read about it applies.
  if (work.start_date !== target.start_date || work.name !== target.name) return null;
  const after = {}, before = {};
  for (const field of EVENT_FIELDS) {
    if (!isEmpty(work[field]) && isEmpty(base[field]) && isEmpty(target[field])) { after[field] = work[field]; before[field] = target[field] ?? null; }
  }
  if (!isEmpty(work.age_categories) && isEmpty(base.age_categories) && isEmpty(target.age_categories)) {
    for (const field of AGE_FIELDS) if (!same(work[field], target[field])) { after[field] = work[field]; before[field] = target[field] ?? null; }
  }
  return Object.keys(after).length ? { after, before } : null;
}

/** A pin, only where neither the server nor the copy ever had one. */
function locationFill(work, base, target) {
  if (!work || !base || !target || work.lat === null || work.lng === null || base.lat !== null || target.lat !== null || target.geog !== null) return null;
  if (target.geocode_status === 'skipped') return null;
  const after = { lat: work.lat, lng: work.lng, geog: `SRID=4326;POINT(${work.lng} ${work.lat})`, geocode_status: 'ok', geocode_query: work.geocode_query ?? null };
  const before = { lat: null, lng: null, geog: null, geocode_status: target.geocode_status ?? null, geocode_query: target.geocode_query ?? null };
  return { after, before };
}

const rows = (database, query) => new Map(JSON.parse(psql(database, `select coalesce(json_agg(t), '[]') from (${query}) t`)).map(row => [row.id, row]));

function fillPlan(directory, { work = 'letsrace', base = 'letsrace_baseline', target, maxRaces = 40, maxPlaces = 40 }) {
  mkdirSync(directory, { recursive: true });
  const columns = ['id', 'name', 'start_date', 'merged_into_id', ...EVENT_FIELDS, ...AGE_FIELDS].join(',');
  // Upcoming races only: an old edition's details help nobody enough to refresh its page.
  const eventsFrom = database => rows(database, `select ${columns} from public.events where start_date >= current_date`);
  const [workEvents, baseEvents, targetEvents] = [eventsFrom(work), eventsFrom(base), eventsFrom(target)];
  const changes = [];
  let waiting = 0, races = 0;
  const filled = new Map();
  for (const [id, row] of workEvents) {
    const fill = eventFills(row, baseEvents.get(id), targetEvents.get(id));
    if (!fill) continue;
    if (races >= maxRaces) { waiting++; continue; }
    races++;
    filled.set(id, Object.keys(fill.after));
    changes.push({ tab: 'public.events', pk: { id }, owner: id, op: 'update', before: fill.before, after: fill.after });
  }
  if (filled.size) {
    const list = [...filled.keys()].map(id => `'${id}'::uuid`).join(',');
    const known = new Set(JSON.parse(psql(base, `select coalesce(json_agg(id), '[]') from public.event_facts where event_id in (${list})`)));
    // Evidence travels with the field it proves.
    const facts = JSON.parse(psql(work, `select coalesce(json_agg(t), '[]') from public.event_facts t where event_id in (${list}) and status = 'active'`));
    for (const fact of facts) if (!known.has(fact.id) && filled.get(fact.event_id).includes(fact.field)) changes.push({ tab: 'public.event_facts', pk: { id: fact.id }, owner: fact.event_id, op: 'insert', after: fact });
    const hasCategories = new Set(JSON.parse(psql(target, `select coalesce(json_agg(distinct event_id), '[]') from public.event_categories where event_id in (${list})`)));
    const categories = JSON.parse(psql(work, `select coalesce(json_agg(t), '[]') from public.event_categories t where event_id in (${list})`));
    for (const category of categories) if (filled.get(category.event_id).includes('age_categories') && !hasCategories.has(category.event_id)) changes.push({ tab: 'public.event_categories', pk: { id: category.id }, owner: category.event_id, op: 'insert', after: category });
  }
  // A place is not tied to one race, and nothing about a pin needs a page refreshed at once.
  const placeColumns = 'id,lat,lng,geog is not null as geog,geocode_query,geocode_status';
  const placesFrom = (database, where) => rows(database, `select ${placeColumns} from public.locations where ${where}`);
  const workPlaces = placesFrom(work, 'lat is not null'), basePlaces = placesFrom(base, 'lat is null'), targetPlaces = placesFrom(target, 'lat is null');
  let places = 0;
  for (const [id, row] of workPlaces) {
    const held = targetPlaces.get(id);
    if (!held) continue;
    const fill = locationFill(row, basePlaces.get(id), { ...held, geog: held.geog ? true : null });
    if (!fill) continue;
    if (places >= maxPlaces) { waiting++; continue; }
    places++;
    changes.push({ tab: 'public.locations', pk: { id }, op: 'update', before: fill.before, after: fill.after });
  }
  const file = join(directory, 'changes.ndjson'), body = changes.map(change => JSON.stringify(change)).join('\n');
  writeFileSync(file, body);
  const sha256 = createHash('sha256').update(body).digest('hex');
  // This module is the review for this kind of change: nothing else can reach the file.
  const fields = {};
  for (const field of [...filled.values()].flat()) fields[field] = (fields[field] ?? 0) + 1;
  writeFileSync(join(directory, 'plan.json'), JSON.stringify({ at: new Date().toISOString(), reviewedAt: new Date().toISOString(), kind: 'fill-empty', rows: changes.length, races, places, waiting, sha256, fields }, null, 2));
  return { file, sha256, rows: changes.length, races, places, waiting };
}

module.exports = { fillPlan, eventFills, locationFill, EVENT_FIELDS, AGE_FIELDS };
