/**
 * The agent's desk: where an agent working in its own session (Codex) picks up cases and hands
 * in answers. The Mac's cycle prepares the cases, checks every quote against its page and hands
 * what holds to the gate; the agent only ever touches this desk.
 *
 *   node scripts/agent-desk.cjs next [--max=5]          the next open cases, as JSON
 *   node scripts/agent-desk.cjs answer <case> <file>    hand in one answer (a JSON file)
 *   node scripts/agent-desk.cjs status                  what is open, answered today, and left of today's allowance
 *   node scripts/agent-desk.cjs repairs [--max=15]      sources no reader fits any more, for the reader-repair agent
 *
 * At most AGENT_DAILY_CASES (20) answers a day, Prague time. An answer out of shape is refused
 * with the reason, and nothing is saved. A case already answered cannot be answered again.
 */
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { checkAnswer, PROMPTS } = require('./agent-answer.cjs');

const data = process.env.LETSRACE_DATA_DIR || path.join(os.homedir(), 'Library/Application Support/LetsRace/data');
const cases = path.join(data, 'agent', 'cases'), answers = path.join(data, 'agent', 'answers');
const DAILY = Number(process.env.AGENT_DAILY_CASES) > 0 ? Number(process.env.AGENT_DAILY_CASES) : 20;
const pragueDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
const json = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };

function state() {
  const index = json(path.join(cases, 'index.json'), []);
  const saved = fs.existsSync(answers) ? fs.readdirSync(answers).filter(name => /^[a-z]+-[0-9a-f]{8}\.json$/.test(name)).map(name => json(path.join(answers, name))).filter(Boolean) : [];
  const today = saved.filter(item => item.at && pragueDay(new Date(item.at)) === pragueDay()).length;
  const done = new Set(saved.map(item => item.case));
  return { open: index.filter(item => PROMPTS[item.kind] && !done.has(item.case)), today, left: Math.max(0, DAILY - today) };
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'status') { const s = state(); console.log(JSON.stringify({ open: s.open.length, answeredToday: s.today, leftToday: s.left, dailyLimit: DAILY })); return; }
  if (command === 'next') {
    const s = state(); const max = Math.min(Number(rest.find(value => value.startsWith('--max='))?.slice(6) ?? 5), s.left);
    const batch = s.open.slice(0, Math.max(0, max)).map(item => ({ ...json(path.join(cases, `${item.case}.json`)), instructions: PROMPTS[item.kind] }));
    console.log(JSON.stringify({ leftToday: s.left, open: s.open.length, cases: batch }, null, 1));
    return;
  }
  if (command === 'answer') {
    const [name, file] = rest; if (!name || !file) throw Error('Usage: agent-desk.cjs answer <case> <file with the JSON answer>');
    if (!/^[a-z]+-[0-9a-f]{8}$/.test(name)) throw Error('Unknown case name');
    const body = json(path.join(cases, `${name}.json`)); if (!body) throw Error(`No such case: ${name}`);
    const target = path.join(answers, `${name}.json`); if (fs.existsSync(target)) throw Error(`${name} already has an answer`);
    if (!state().left) throw Error(`Today's ${DAILY} answers are used up; come back tomorrow`);
    const checked = checkAnswer(body.kind, body, fs.readFileSync(file, 'utf8'));
    if (!checked.ok) throw Error(`Refused: ${checked.why}`);
    fs.mkdirSync(answers, { recursive: true });
    fs.writeFileSync(`${target}.tmp`, JSON.stringify({ case: name, kind: body.kind, at: new Date().toISOString(), by: process.env.AGENT_NAME || 'codex', answer: checked.answer }, null, 1));
    fs.renameSync(`${target}.tmp`, target);
    console.log(JSON.stringify({ saved: name, verdict: checked.answer.verdict, leftToday: state().left }));
    return;
  }
  if (command === 'repairs') {
    // Sources the readers cannot make sense of, most races at stake first. Read from the Mac's copy; nothing is changed.
    const bin = process.env.LOCAL_PG_BIN || '/opt/homebrew/opt/postgresql@17/bin';
    const sql = `select coalesce(json_agg(t),'[]') from (select w.url, w.kind, w.operational_state as state, w.last_extract_status as last_read, left(coalesce(w.last_error,''),200) as last_error, w.last_fetched_at,
      (select count(*) from public.event_sources x join public.events e on e.id=x.event_id where x.watched_url_id=w.id and e.merged_into_id is null) as races_from_it
      from public.watched_urls w where w.status='active' and (w.operational_state in ('unreadable','review','broken') or w.last_extract_status in ('needs_review','error'))
      order by 7 desc, w.last_fetched_at desc nulls last limit ${Math.min(Number(rest.find(value => value.startsWith('--max='))?.slice(6) ?? 15), 50)}) t`;
    console.log(require('node:child_process').execFileSync(`${bin}/psql`, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace', '-qAt', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 24 }).trim());
    return;
  }
  throw Error('Commands: next [--max=N], answer <case> <file>, status, repairs [--max=N]');
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
