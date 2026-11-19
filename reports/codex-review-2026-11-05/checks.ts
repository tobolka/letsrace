/** Pure fixtures only: no environment loading, network, database or collector. */
import { createRequire } from 'node:module';
import { chooseEventType, isSamePlace } from '../../src/lib/watcher/update-policy';
import { newRaceProblems } from '../../src/lib/local-pass/new-race-check';
const require = createRequire(import.meta.url);
const { separateForReview } = require('../../scripts/local-sync.cjs');
const place = { municipality: 'Brno', country_code: 'CZ', lat: 49.195, lng: 16.607 };
const race = { id: 'fixture-a', name: 'Forest Cross Brno', start_date: '2027-05-01', visibility: 'public', event_type: 'race', disciplines: ['xco'] };
const child = { tab: 'public.event_sources', pk: { id: 'fixture-source' }, op: 'update', before: { source_url: 'old' }, after: { source_url: 'new' } };
console.log(JSON.stringify({
  heldRaceChild: separateForReview([{ tab: 'public.events', pk: { id: race.id }, op: 'update', before: { start_date: '2027-05-01' }, after: { start_date: '2027-06-01' } }, child]),
  explicitTypeCorrection: chooseEventType('race', 'series', 'race'),
  unlocatedTownVersusPrecisePin: isSamePlace({ ...place, lat: null, lng: null }, { query: 'Brno', country: 'CZ', lat: place.lat, lng: place.lng }),
  differentVenuesInSameTown: isSamePlace(place, { query: 'Brno', country: 'CZ', lat: 49.217, lng: 16.625 }),
  noSourceEvidenceRequired: newRaceProblems(race, place, [], '2026-11-05'),
  secondIncomingRaceWithAllNewIdsExcluded: newRaceProblems({ ...race, id: 'fixture-b' }, place, [], '2026-11-05'),
  sameRaceWhenComparedWithPeer: newRaceProblems({ ...race, id: 'fixture-b' }, place, [{ ...race, place }], '2026-11-05'),
}, null, 2));
