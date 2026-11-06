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

const EVENT_FIELDS = ['website_url', 'registration_url', 'regulations_url', 'results_url', 'class_label', 'competition_type', 'description', 'level', 'uci_class', 'formats', 'registration_opens_at', 'registration_closes_at', 'disciplines'];
/** Categories are one fact: their companions move only with them. */
const AGE_FIELDS = ['age_categories', 'age_confidence', 'audience'];
const LOCATION_FIELDS = ['lat', 'lng', 'geog', 'geocode_query', 'geocode_status'];
const isEmpty = value => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Venue, organiser, programme, fees and routes are separate facts: a race with a venue can still gain its programme. Each only where empty in all three senses, and never where someone locked it. */
function practicalFill(work, base, target) {
  const locks = target.locked_fields ?? [];
  if (locks.includes('practical_details')) return null;
  const held = target.practical_details ?? {}, known = base.practical_details ?? {}, added = {};
  for (const [field, fact] of Object.entries(work.practical_details ?? {})) {
    if (!isEmpty(fact) && isEmpty(known[field]) && isEmpty(held[field]) && !locks.includes(`practical.${field}`)) added[field] = fact;
  }
  return Object.keys(added).length ? { ...held, ...added } : null;
}

/** Only what the second reader confirmed, for the value it saw, may leave the Mac. */
function confirmedDetails(details, entry) {
  const kept = {};
  for (const [field, fact] of Object.entries(details ?? {})) {
    if (field === 'documents') { kept[field] = fact; continue; }
    const check = entry?.fields?.[field];
    if (check?.verdict === 'confirmed' && check.value === valueHash(fact?.value)) kept[field] = fact;
  }
  return kept;
}
const valueHash = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);

/** The pure decision, for one race as held in the three places. */
const STAND_IN_HOSTS = /(^|\.)(kalendar\.winspace\.cz|odjazd\.pl|kalendarzrowerowy\.pl|eventivsport\.com|granfondoguide\.com|finishers\.com|bikeboard\.at|radsport-events\.de|rideandrest\.net)$/i;
function pageKind(url) {
  try {
    const { hostname, pathname } = new URL(url);
    if (STAND_IN_HOSTS.test(hostname.replace(/^www\./, ''))) return 'calendar';
    return pathname.replace(/\/+$/, '') ? 'page' : 'home';
  } catch { return null; }
}
/** Someone changing the link on the server since the copy keeps it; only stand-ins are replaced, and never by one. */
function betterWebsite(work, base, target) {
  if (!work || !target || work === target || base !== target) return false;
  const was = pageKind(target), now = pageKind(work);
  return now === 'page' && (was === 'home' || was === 'calendar');
}
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
  // The one value that may change: a homepage or a calendar's stand-in gives way to the race's own page.
  if (betterWebsite(work.website_url, base.website_url, target.website_url)) { after.website_url = work.website_url; before.website_url = target.website_url; }
  const practical = practicalFill(work, base, target);
  if (practical) { after.practical_details = practical; before.practical_details = target.practical_details ?? {}; }
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

function fillPlan(directory, { work = 'letsrace', base = 'letsrace_baseline', target, maxRaces = 40, maxPlaces = 40, gate = null }) {
  mkdirSync(directory, { recursive: true });
  const columns = ['id', 'name', 'start_date', 'merged_into_id', 'practical_details', ...EVENT_FIELDS, ...AGE_FIELDS].join(',');
  // Upcoming races only: an old edition's details help nobody enough to refresh its page.
  const eventsFrom = database => rows(database, `select ${columns} from public.events where start_date >= current_date`);
  const [workEvents, baseEvents, targetEvents] = [eventsFrom(work), eventsFrom(base), eventsFrom(target)];
  const targetLocks = rows(target, `select event_id as id, locked_fields from public.event_overrides`);
  const changes = [];
  let waiting = 0, races = 0;
  const filled = new Map();
  for (const [id, row] of workEvents) {
    const held = targetEvents.get(id);
    const checked = gate ? { ...row, practical_details: confirmedDetails(row.practical_details, gate[id]) } : row;
    const fill = eventFills(checked, baseEvents.get(id), held && { ...held, locked_fields: targetLocks.get(id)?.locked_fields });
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
    for (const fact of facts) if (!known.has(fact.id) && (filled.get(fact.event_id).includes(fact.field) || String(fact.field).startsWith('practical.') && filled.get(fact.event_id).includes('practical_details') && (!gate || confirmedDetails(workEvents.get(fact.event_id)?.practical_details, gate[fact.event_id])[String(fact.field).slice(10)]))) changes.push({ tab: 'public.event_facts', pk: { id: fact.id }, owner: fact.event_id, op: 'insert', after: fact });
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

module.exports = {betterWebsite, confirmedDetails, valueHash, fillPlan, eventFills, practicalFill, locationFill, EVENT_FIELDS, AGE_FIELDS };
