/**
 * Races the Mac held back, with a button for each: drop it for good, or let it through.
 * Only on this computer (127.0.0.1:54341). A decision goes to one local file, held-decisions.json,
 * which the next cycle reads; nothing is sent from here.
 *
 *   node scripts/held-decisions.cjs        then open http://127.0.0.1:54341
 *
 * "Let it through" lifts only the opinions the system had (may already be listed, listed as a ride,
 * name says too little). A past day, a missing source or a record already on the server stays held.
 * The race then still has to pass every other check before anything is sent.
 */
const http = require('node:http');
const { readFileSync, writeFileSync, renameSync, readdirSync, existsSync, mkdirSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const DATA = process.env.LETSRACE_DATA_DIR || join(homedir(), 'Library', 'Application Support', 'LetsRace', 'data');
const FILE = join(DATA, 'held-decisions.json');
const REASONS = {
  may_already_be_listed: 'Možná už v katalogu je', listed_as_a_ride: 'Vedený jako vyjížďka', no_usable_place: 'Bez použitelného místa',
  source_not_in_target_catalogue: 'Zdroj není na serveru', name_says_too_little: 'Název nic neříká', no_future_date: 'Bez budoucího termínu',
  already_on_server: 'Už je na serveru', no_source_read_in_this_pass: 'Bez přečteného zdroje', not_a_cycling_race: 'Není to cyklistický závod',
};
const SOFT = new Set(['may_already_be_listed', 'listed_as_a_ride', 'name_says_too_little']);
const esc = value => String(value ?? '–').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; } };

/** The newest cycle that wrote a plan with held races. */
function latestPlan() {
  const root = join(DATA, 'local-cycles');
  if (!existsSync(root)) return null;
  for (const run of readdirSync(root).sort().reverse()) {
    const plan = readJson(join(root, run, 'plan', 'plan.json'), null);
    if (plan?.newRaces) return { run, plan };
  }
  return null;
}

function decide(id, action) {
  if (!/^[-a-f0-9]{36}$/.test(id) || !['drop', 'release', 'undo'].includes(action)) throw Error('Neplatné rozhodnutí');
  const all = readJson(FILE, {});
  if (action === 'undo') delete all[id]; else all[id] = { action, at: new Date().toISOString() };
  mkdirSync(DATA, { recursive: true, mode: 0o700 });
  const tmp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  renameSync(tmp, FILE);
}

function page() {
  const found = latestPlan();
  const decisions = readJson(FILE, {});
  const held = (found?.plan.newRaces.held ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const rows = held.map(race => {
    // Plans written before the Mac knew the ids have none; they get buttons after the next cycle.
    if (!race.id) return `<tr><td>${esc(race.date)}</td><td>${esc(race.name)}</td><td>${race.because.map(reason => esc(REASONS[reason] ?? reason)).join(', ')}</td><td>–</td><td class="muted">po příštím průchodu</td></tr>`;
    const mine = decisions[race.id]?.action;
    const soft = race.because.every(reason => SOFT.has(reason));
    const buttons = `<form method="post" action="/decide" style="display:inline"><input type="hidden" name="id" value="${esc(race.id)}">
${mine ? `<b>${mine === 'drop' ? 'Zahodit' : 'Pustit'} (od příštího průchodu)</b> <button name="action" value="undo">Vrátit</button>`
  : `<button name="action" value="drop">Zahodit</button> ${soft ? '<button name="action" value="release">Pustit</button>' : '<span class="muted">nelze pustit</span>'}`}</form>`;
    return `<tr><td>${esc(race.date)}</td><td>${esc(race.name)}<br><span class="muted">${esc([race.place, race.country].filter(Boolean).join(', '))}</span></td>
<td>${race.because.map(reason => esc(REASONS[reason] ?? reason)).join(', ')}</td>
<td>${race.source ? `<a href="${esc(race.source)}" target="_blank" rel="noreferrer">zdroj</a>` : '–'}</td><td>${buttons}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Zadržené závody</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root{color-scheme:light dark;--line:#8884;--muted:#8a8a8a}body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:1040px;margin:0 auto;padding:28px 20px}
h1{font-size:24px;margin:0 0 4px}.muted{color:var(--muted)}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:600}button{font:inherit;padding:2px 10px}</style></head><body>
<h1>Zadržené nové závody (${held.length})</h1>
<p class="muted">Nejbližší termín první. Rozhodnutí se uloží do jednoho místního souboru a platí od příštího průchodu Macu. Odsud nic neodchází.
${found ? `Plán z průchodu ${esc(found.run)}.` : 'Zatím žádný plán.'}</p>
<table><thead><tr><th>Termín</th><th>Závod</th><th>Důvod</th><th></th><th>Rozhodnutí</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Nic nečeká.</td></tr>'}</tbody></table>
</body></html>`;
}

const server = http.createServer((request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/decide') {
      let body = '';
      request.on('data', chunk => { body += chunk; if (body.length > 4096) request.destroy(); });
      request.on('end', () => {
        try {
          const form = new URLSearchParams(body);
          decide(form.get('id') ?? '', form.get('action') ?? '');
          response.writeHead(303, { location: '/' });
        } catch (error) { response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); response.write(error.message); }
        response.end();
      });
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(page());
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Stránku se nepodařilo načíst: ${error.message}`);
  }
});
if (require.main === module) server.listen(54341, '127.0.0.1', () => console.log('http://127.0.0.1:54341'));

module.exports = { decide, SOFT };
