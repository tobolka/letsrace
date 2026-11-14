/**
 * What a pass on the Mac is doing and what it found, in a browser, on this computer only.
 * It only reads local files: no server requests, and no button can send anything.
 *
 *   node scripts/local-dashboard.cjs [--plan=DIR] [--report=FILE]     then open http://127.0.0.1:54340
 */
const http = require('node:http');
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const DATA = join(homedir(), 'Library', 'Application Support', 'LetsRace', 'data');
const RUN = join(DATA, 'local-pass-run');
const planDirectory = arg('plan') ?? join(DATA, 'local-pass-run', 'plan');
const reportFile = arg('report') ?? join(DATA, 'local-pass-run', 'report.json');

const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const escape = value => String(value ?? '–').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const reasonNames = {
  name_says_too_little: 'Název nic neříká', not_a_cycling_race: 'Není to cyklistický závod', listed_as_a_ride: 'Je vedený jako vyjížďka', already_on_server: 'Už je na serveru',
  no_future_date: 'Bez budoucího termínu', no_usable_place: 'Bez použitelného místa', place_not_on_the_map: 'Místo nejde na mapu',
  may_already_be_listed: 'Možná už v katalogu je', no_source_read_in_this_pass: 'Bez přečteného zdroje', date_not_found_on_source: 'Termín na zdroji nenalezen',
  start_date: 'Změna termínu', end_date: 'Změna konce', name: 'Změna názvu', status: 'Změna stavu', merged_into_id: 'Sloučení',
};
const table = (head, rows) => rows.length
  ? `<table><thead><tr>${head.map(cell => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="empty">Nic k zobrazení.</p>';

function heldRaces() {
  const file = join(planDirectory, 'held-for-review.ndjson');
  if (!existsSync(file)) return [];
  const byRace = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const change = JSON.parse(line);
    if (change.tab === 'public.events' && change.op === 'update') byRace.set(change.pk.id, change);
  }
  return [...byRace.values()];
}

function page() {
  const status = readJson(join(RUN, 'status.json'));
  const report = readJson(reportFile);
  const plan = readJson(join(planDirectory, 'plan.json'));
  const held = heldRaces();
  const age = status ? Math.round((Date.now() - Date.parse(status.at)) / 1000) : null;
  const active = status?.state === 'running' && age < 30;
  const state = !status ? 'Zatím žádný průchod' : active ? 'Běží' : status.state === 'running' ? 'Přerušeno' : status.state === 'finished' ? 'Dokončeno' : 'Zastaveno';
  const logs = existsSync(join(RUN, 'logs')) ? readdirSync(join(RUN, 'logs')).length : 0;

  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>LetsRace na Macu</title>${active ? '<meta http-equiv="refresh" content="10">' : ''}
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:light dark;--line:#8884;--muted:#8a8a8a}
body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:1040px;margin:0 auto;padding:28px 20px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px}p{margin:6px 0}.muted,.empty{color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
.card{border:1px solid var(--line);border-radius:8px;padding:12px}.card b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600}
td:not(:first-child){font-variant-numeric:tabular-nums}code{font-size:13px;word-break:break-all}
</style></head><body>
<h1>LetsRace na Macu</h1>
<p class="muted">Jen čte místní soubory. Na server odsud nic nejde.</p>
<div class="cards">
<div class="card"><b>${escape(state)}</b>Stav průchodu</div>
<div class="card"><b>${escape(status?.due)}</b>Zdrojů zbývá</div>
<div class="card"><b>${escape(status?.workers?.filter(worker => worker.running).length)}</b>Procesů běží</div>
<div class="card"><b>${escape(status?.freeMemoryGb)} GB</b>Volná paměť</div>
<div class="card"><b>${escape(report?.overall?.ok)} / ${escape(report?.overall?.sourcesRead)}</b>Zdrojů přečteno</div>
<div class="card"><b>${escape(report?.overall?.databaseRequestsSpared)}</b>Požadavků ušetřeno serveru</div>
</div>
<p class="muted">Začátek ${escape(status?.startedAt)}, poslední zpráva ${age == null ? '–' : `před ${age} s`}, záznamy ${logs} procesů.</p>

<h2>Ročníky 2027 podle zemí</h2>
<p class="muted">Termíny se nedopočítávají. „Bez ročníku, zdroj přečten“ znamená, že termín zatím nevidíme. „Nezkontrolováno“ znamená, že o závodě nevíme nic nového.</p>
${table(['Země', 'Závody loni', 'S ročníkem', '%', 'Bez ročníku, zdroj přečten', 'Nezkontrolováno', 'Nové záznamy'],
  (report?.countries ?? []).map(c => [c.country, c.lastYearRaces, c.withEditionNow, c.percentNow, c.noEditionButSourceChecked, c.noEditionAndNotChecked, c.newRecords]))}

<h2>Připraveno k odeslání</h2>
${plan ? `<p>${escape(plan.rows)} řádků. ${plan.reviewedAt ? 'Prošlo kontrolou nových závodů.' : 'Kontrola nových závodů ještě neproběhla, takže odeslání je zablokované.'}</p>
<p class="muted">Otisk: <code>${escape(plan.sha256)}</code></p>` : '<p class="empty">Žádný připravený návrh.</p>'}

<h2>Nové závody připravené (${plan?.newRaces?.ready?.length ?? 0})</h2>
${table(['Termín', 'Závod'], (plan?.newRaces?.ready ?? []).map(race => [race.date, race.name]))}

<h2>Nové závody zadržené (${plan?.newRaces?.held?.length ?? 0})</h2>
${table(['Termín', 'Závod', 'Důvod'], (plan?.newRaces?.held ?? []).map(race => [race.date, race.name, race.because.map(reason => reasonNames[reason] ?? reason).join(', ')]))}

<h2>Změny závodů zadržené k posouzení (${held.length})</h2>
${table(['Co se mění', 'Bylo', 'Má být'], held.map(change => [(change.heldBecause ?? []).map(reason => reasonNames[reason] ?? reason).join(', '), change.before?.start_date ?? change.before?.name ?? change.before?.status, change.after?.start_date ?? change.after?.name ?? change.after?.status]))}

<h2>Zdroje, které přestaly dávat závody (${report?.silentSources?.length ?? 0})</h2>
${table(['Zdroj', 'Dřív závodů', 'Odpověď', 'Chyba'], (report?.silentSources ?? []).slice(0, 60).map(source => [source.url, source.prior, source.status, source.error]))}

<h2>Nejčastější chyby</h2>
${table(['Chyba', 'Počet'], (report?.failures ?? []).map(failure => [failure.error, failure.count]))}

<h2>Nejdražší zdroje</h2>
${table(['Zdroj', 'Požadavků', 'Zápisů', 'Řádků'], (report?.costliest ?? []).map(source => [source.url, source.database, source.upserted, source.extracted]))}
</body></html>`;
}

http.createServer((_request, response) => {
  try {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(page());
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Přehled se nepodařilo načíst: ${error.message}`);
  }
}).listen(54340, '127.0.0.1', () => console.log('http://127.0.0.1:54340'));
