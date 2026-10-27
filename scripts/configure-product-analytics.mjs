/** Idempotent private Umami reports. Token read from an ignored local session file. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const websiteId = process.env.UMAMI_WEBSITE_ID || '21150631-b65b-4b9e-966e-c87fb90e14e2';
const base = process.env.UMAMI_URL || 'https://stats.letsrace.cz';
if (new URL(base).origin !== 'https://stats.letsrace.cz') throw new Error('Unexpected Umami destination');
const sessionFile = process.env.UMAMI_SESSION_FILE;
if (!sessionFile) throw new Error('Set UMAMI_SESSION_FILE to the existing local session file; never paste a token');
const { token } = JSON.parse(readFileSync(sessionFile, 'utf8'));
async function api(path, body) {
  const response = await fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Umami ${path}: HTTP ${response.status}`);
  return response.json();
}
const rows = value => Array.isArray(value) ? value : value.data || [];
const event = (value, filters) => ({ type: 'event', value, ...(filters ? { filters } : {}) });
const eq = (property, value) => ({ property, operator: 'eq', value });
const descriptions = 'Product signal, not proof of race registration or participation. Ordered anonymous-session steps; not a same-race join.';
const definitions = [
  ['Mapa → detail', [event('section_view', [eq('section', 'map')]), event('race_view')]],
  ['Seznam → detail', [event('section_view', [eq('section', 'list')]), event('race_view')]],
  ['Kalendář → detail', [event('section_view', [eq('section', 'schedule')]), event('race_view')]],
  ['Hledání → detail', [event('search_completed', [eq('outcome', 'results')]), event('race_view')]],
  ['Detail s registrací → registrační záměr', [event('race_view', [eq('has_registration', 'true')]), event('race_registration_start')]],
  ['Uložení do plánu', [event('plan_save_requested'), event('plan_save_completed')]],
];
const funnels = rows(await api(`/websites/${websiteId}/funnels?pageSize=100`));
const ids = {};
for (const [name, steps] of definitions) {
  let saved = funnels.find(item => item.name === name);
  const body = { name, description: descriptions, parameters: { window: 30, steps } };
  saved = await api(`/websites/${websiteId}/funnels${saved ? `/${saved.id}` : ''}`, body);
  ids[name] = saved.id;
}
const goals = rows(await api(`/websites/${websiteId}/goals?pageSize=100`));
let goal = goals.find(item => item.name === 'Potvrzené uložení závodu');
goal = await api(`/websites/${websiteId}/goals${goal ? `/${goal.id}` : ''}`, { name: 'Potvrzené uložení závodu', description: 'Confirmed new insert, not a button click. No registration-completion inference.', parameters: { type: 'event', value: 'plan_save_completed' } });
const column = (type, title, props = {}) => ({ id: randomUUID(), size: 1, component: { type, title, props } });
const row = (...columns) => ({ id: randomUUID(), columns });
const property = (title, eventName, propertyName, propertyFilters = []) => column('EventProperty', title, { eventName, propertyName, propertyFilters });
const funnel = name => column('Funnel', name, { reportId: ids[name] });
const notes = text => row(column('TextBlock', 'Jak číst přehled', { text }));
const boards = [
  { name: 'LetsRace — Produkt', rows: [
    notes('Nové vlastnosti se sbírají od produktového vydání. Porovnávej stejné zdroje návštěv a sezónu. Zobrazení sekce není unikátní člověk; kliknutí na registraci není dokončená registrace. Soukromé stránky mají jen obecný název sekce. Při malém vzorku použij 28 dnů.'),
    row(property('Které sekce lidé otevírají', 'section_view', 'section')),
    row(funnel('Mapa → detail'), funnel('Seznam → detail')),
    row(funnel('Kalendář → detail'), funnel('Detail s registrací → registrační záměr')),
    row(funnel('Uložení do plánu'), column('Goal', 'Potvrzené uložení závodu', { reportId: goal.id })),
  ] },
  { name: 'LetsRace — Hledání a filtry', rows: [
    notes('Nuly jsou dokončené odpovědi, chyby se počítají samostatně. V mapě může nula znamenat pouze prázdnou oblast. Počet událostí není počet návštěvníků. Kombinace filtrů zkoumej v Events → Properties; samotné použití filtru není důkaz jeho přínosu.'),
    row(property('Výsledek hledání', 'search_completed', 'outcome'), property('Hledání závodu nebo místa', 'search_completed', 'mode')),
    row(property('Kolik závodů se zobrazí', 'results_view', 'result_bucket'), property('Použité filtry', 'filter_apply', 'filter_type')),
    row(property('Země při nulovém výsledku', 'results_view', 'country_set', [{ propertyName: 'result_count', dataType: 2, operator: 'eq', value: '0' }]), property('Datum při nulovém výsledku', 'results_view', 'date_mode', [{ propertyName: 'result_count', dataType: 2, operator: 'eq', value: '0' }])),
    row(funnel('Hledání → detail'), property('Technické chyby', 'action_failed', 'action')),
  ] },
  { name: 'LetsRace — Akvizice', rows: [
    notes('Akvizice popisuje příchody. Její kvalitu posuzuj návazně podle otevření závodu a registračního záměru. Návratovost je odhad anonymní identity: Retention najdeš v přehledu website; D7 není návrat kdykoli během sedmi dnů.'),
    row(column('MetricsTable', 'Vstupní stránky', { type: 'entry', limit: 20 }), column('MetricsTable', 'Zdroje návštěv', { type: 'referrer', limit: 20 })),
    row(column('UTM', 'Kampaně', { param: 'utm_campaign', limit: 10 }), column('MetricsTable', 'Zařízení', { type: 'device', limit: 10 })),
  ] },
];
const existingBoards = rows(await api('/boards?pageSize=100'));
for (const spec of boards) {
  const old = existingBoards.find(item => item.name === spec.name && item.parameters?.websiteId === websiteId);
  const body = { type: 'website', name: spec.name, description: 'Private LetsRace product analytics. Counts, funnels and source context.', parameters: { websiteId, rows: spec.rows } };
  const saved = await api(`/boards${old ? `/${old.id}` : ''}`, body);
  const verified = await api(`/boards/${saved.id}`);
  if (verified.parameters?.websiteId !== websiteId || verified.name !== spec.name) throw new Error('Board verification failed');
  console.log(`${spec.name}: ${base}/boards/${saved.id}`);
}
console.log(`Verified ${definitions.length} saved funnels and 1 goal. No public shares, tracking settings or database migrations changed.`);
