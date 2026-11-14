/**
 * The agent's daily turn, as a step of the Mac's cycle: ask it the next cases, then check its
 * quotes against the pages. Everything stays in the data folder; nothing reaches the catalogue.
 * agent-run.cjs keeps the limits (one run a day, 20 cases, time and cost a case).
 *
 *   node scripts/agent-daily.cjs [--max=20]
 */
const cp = require('node:child_process'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const data = process.env.LETSRACE_DATA_DIR || path.join(os.homedir(), 'Library/Application Support/LetsRace/data');
const cases = path.join(data, 'agent', 'cases'), answers = path.join(data, 'agent', 'answers');
const max = process.argv.find(value => value.startsWith('--max='))?.slice(6) ?? '20';
const outcome = (kind, reason) => console.log('step_outcome ' + JSON.stringify({ outcome: kind, reason }));

// An answer that settled nothing ("not published yet", "unsure", refused) is asked again after a week.
const AGAIN_AFTER_MS = 7 * 24 * 3600_000;
if (fs.existsSync(answers)) for (const name of fs.readdirSync(answers).filter(file => /^[a-z]+-[0-9a-f]{8}\.json$/.test(file))) {
  try { const saved = JSON.parse(fs.readFileSync(path.join(answers, name), 'utf8')); const settled = ['found', 'same', 'different', 'race', 'ride', 'announced', 'not_a_race'].includes(saved.answer?.verdict);
    // A calendar is never settled: new races keep being added to it.
    const calendar = saved.kind === 'find_races';
    if ((!settled || calendar) && Date.now() - Date.parse(saved.at) > (calendar && saved.answer?.verdict === 'found' ? 2 : 1) * AGAIN_AFTER_MS) { fs.mkdirSync(path.join(answers, 'earlier'), { recursive: true }); fs.renameSync(path.join(answers, name), path.join(answers, 'earlier', `${saved.at.slice(0, 10)}-${name}`)); }
  } catch { /* An unreadable answer stays where it is. */ }
}
// Fresh cases from the Mac's copy of the catalogue and the latest cycle's held races. If that fails, yesterday's stand.
if (!process.argv.includes('--keep-cases')) {
  const cycles = path.join(data, 'local-cycles'); let plan = null;
  try { plan = fs.readdirSync(cycles).sort().reverse().map(name => path.join(cycles, name, 'plan', 'plan.json')).find(file => fs.existsSync(file)) ?? null; } catch { /* no cycles yet */ }
  // The newest season's organiser check holds the races whose next date is still looked for.
  let editions = null; try { editions = fs.readdirSync(data).filter(name => /^organiser-check-\d{4}$/.test(name)).sort().reverse().map(name => path.join(data, name)).find(dir => fs.existsSync(path.join(dir, 'edition-status.json'))) ?? null; } catch { /* none yet */ }
  const built = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'node_modules/tsx/dist/cli.mjs'), path.join(__dirname, 'agent-cases.ts'), `--out=${cases}`, `--skip=${answers}`, '--regulations=30', '--duplicates=15', ...(plan ? [`--plan=${plan}`] : []), ...(editions ? [`--editions=${editions}`] : [])], { encoding: 'utf8', timeout: 180_000 });
  if (built.status !== 0) console.warn(`Nové případy se nepodařilo připravit: ${(built.stderr || '').split('\n').filter(Boolean).at(-1) ?? built.status}`);
}
if (!fs.existsSync(path.join(cases, 'index.json'))) { console.log('agent_daily ' + JSON.stringify({ ran: false, why: 'no cases prepared' })); process.exit(0); }
// The owner's choice (11 Nov 2026): the agent is Codex, working through scripts/agent-desk.cjs in its own
// session, so nothing here spends the Claude subscription. AGENT_IN_CYCLE=1 lets this step ask an agent itself.
const inCycle = process.env.AGENT_IN_CYCLE === '1';
const ran = inCycle ? cp.spawnSync(process.execPath, [path.join(__dirname, 'agent-run.cjs'), `--cases=${cases}`, `--out=${answers}`, `--max=${max}`], { encoding: 'utf8', maxBuffer: 2 ** 24 }) : null;
let run = inCycle ? null : { ran: false, why: 'the agent works through the desk' }; if (inCycle) try { run = JSON.parse((ran.stdout ?? '').trim().split('\n').at(-1)); } catch { /* reported below */ }
if (!run) { console.error((ran.stderr || ran.stdout || 'the agent run gave no result').slice(-400)); outcome('failed', 'crashed'); process.exit(1); }
// Answers may have arrived through the desk since the last look; check whatever is new.
const newest = file => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } };
const lastAnswer = fs.existsSync(answers) ? Math.max(0, ...fs.readdirSync(answers).filter(name => /^[a-z]+-[0-9a-f]{8}\.json$/.test(name)).map(name => newest(path.join(answers, name)))) : 0;
if ((run.ran && run.asked) || lastAnswer > newest(path.join(answers, 'verified.json'))) {
  // The quotes are looked for on the pages themselves; what is not found there goes nowhere.
  const verify = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'node_modules/tsx/dist/cli.mjs'), path.join(__dirname, 'agent-verify.ts'), `--answers=${answers}`], { encoding: 'utf8', maxBuffer: 2 ** 24, timeout: 15 * 60_000 });
  const rows = (() => { try { return JSON.parse(fs.readFileSync(path.join(answers, 'verified.json'), 'utf8')); } catch { return []; } })();
  run.verified = rows.filter(row => row.verified === true).length; run.unverified = rows.filter(row => row.verified === false).length; run.answersInAll = rows.length;
  if (verify.status !== 0) run.verifyError = (verify.stderr ?? '').slice(-200);
  // Pairs judged different, with every quote found on its page: the cycle stops holding them as possible doubles.
  const separate = rows.filter(row => row.kind === 'decide_duplicate' && row.verdict === 'different' && row.verified === true)
    .map(row => { try { const { a, b } = JSON.parse(fs.readFileSync(path.join(answers, `${row.case}.json`), 'utf8')).answer; return { a, b, case: row.case }; } catch { return null; } }).filter(Boolean);
  fs.writeFileSync(path.join(data, 'agent', 'separate.json'), JSON.stringify(separate, null, 1));
  run.separatePairs = separate.length;
  const answerOf = row => { try { return JSON.parse(fs.readFileSync(path.join(answers, `${row.case}.json`), 'utf8')).answer; } catch { return null; } };
  // Judged a race, not a ride, with the quotes found: the cycle stops holding it for its source's label.
  // An answer about one record of a race is filed for its other records too (same_race_ids).
  const everyRecord = answer => [answer?.race, ...(answer?.same_race_ids ?? [])].filter(Boolean);
  const races = rows.filter(row => row.kind === 'decide_ride' && row.verdict === 'race' && row.verified === true).flatMap(row => everyRecord(answerOf(row)).map(id => ({ id, case: row.case })));
  fs.writeFileSync(path.join(data, 'agent', 'races.json'), JSON.stringify(races, null, 1)); run.confirmedRaces = races.length;
  // Entries judged rides without a result, with the quote found on the page. Kept as a list: nothing is hidden from here.
  const rides = rows.filter(row => row.verified === true && (row.kind === 'decide_ride' && row.verdict === 'ride' || row.kind === 'find_regulations' && row.verdict === 'not_a_race')).flatMap(row => everyRecord(answerOf(row)).map(id => ({ id, case: row.case, note: answerOf(row)?.note ?? null })));
  fs.writeFileSync(path.join(data, 'agent', 'rides.json'), JSON.stringify(rides, null, 1)); run.judgedRides = rides.length;
  // An announced date, quoted in full on a page that was read again, joins the reviewed answers.
  // The cycle's own check (check-next-editions --answers) still decides whether a new edition is made.
  let dates = 0;
  for (const row of rows.filter(item => item.kind === 'find_next_date' && item.verdict === 'announced' && item.verified === true)) {
    const answer = answerOf(row), body = (() => { try { return JSON.parse(fs.readFileSync(path.join(cases, `${row.case}.json`), 'utf8')); } catch { return null; } })();
    if (!answer || !body?.wanted_year) continue;
    const file = path.join(data, `organiser-check-${body.wanted_year}`, 'reviewed-answers.json'); if (!fs.existsSync(path.dirname(file))) continue;
    const reviewed = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } })();
    const fresh = everyRecord(answer).filter(id => !reviewed[id]); if (!fresh.length) continue;
    for (const id of fresh) reviewed[id] = { url: answer.url, startDate: answer.start_date, endDate: answer.end_date ?? null, quote: answer.quote, name: body.race?.name ?? null, reviewedBy: `agent ${new Date().toISOString().slice(0, 10)}` };
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(reviewed, null, 1)); fs.renameSync(`${file}.tmp`, file); dates++;
  }
  run.announcedDates = dates;
  // A planned date, quoted on a page read again, is kept as provisional beside the check's own: never as an announcement.
  let planned = 0;
  for (const row of rows.filter(item => item.kind === 'find_next_date' && item.verdict === 'planned' && item.verified === true)) {
    const answer = answerOf(row), body = (() => { try { return JSON.parse(fs.readFileSync(path.join(cases, `${row.case}.json`), 'utf8')); } catch { return null; } })();
    if (!answer || !body?.wanted_year) continue;
    const file = path.join(data, `organiser-check-${body.wanted_year}`, 'provisional-dates.json'); if (!fs.existsSync(path.dirname(file))) continue;
    const kept = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } })();
    const day = new Date().toISOString().slice(0, 10);
    const fresh = everyRecord(answer).filter(id => !kept[id]); if (!fresh.length) continue;
    for (const id of fresh) kept[id] = { name: body.race?.name ?? null, url: answer.url, startDate: answer.start_date, endDate: answer.end_date ?? null, quote: answer.quote, firstSeen: day, lastSeen: day, by: 'agent' };
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(kept, null, 1)); fs.renameSync(`${file}.tmp`, file); planned++;
  }
  run.plannedDates = planned;
}
const left = (() => { try { return JSON.parse(fs.readFileSync(path.join(cases, 'index.json'), 'utf8')).filter(item => !fs.existsSync(path.join(answers, `${item.case}.json`))).length; } catch { return null; } })();
console.log('agent_daily ' + JSON.stringify({ ...run, casesLeft: left }));
// Not signed in or out of allowance is a wait, not a failure of the step.
if (run.stopped?.startsWith('the agent cannot work')) { outcome('waiting', 'agent_unavailable'); process.exit(1); }
