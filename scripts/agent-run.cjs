/**
 * Run the agent over prepared cases, within limits the owner can count on.
 *
 *   node scripts/agent-run.cjs --cases=<dir> --out=<dir> [--max=20] [--kind=find_regulations] [--force]
 *
 * Limits, all enforced here and not left to the agent:
 *   - one run a day (Prague time), remembered in <out>/agent-state.json; --force is for a person at the keyboard
 *   - at most --max cases a run (default 20), each started once: a case with an answer is never asked again
 *   - at most AGENT_CASE_SECONDS (240) and AGENT_CASE_USD (0.40) a case, and AGENT_RUN_USD (4) a run
 *   - the run stops at the first sign that the agent cannot work: not signed in, or its allowance is spent
 *
 * The agent gets a case file and three tools: read a web page, search the web, read the case file.
 * It writes nothing and decides nothing; its answer is text that scripts/agent-answer.cjs checks.
 * AGENT_CMD replaces the command (the case's prompt arrives on stdin), which is how another tool,
 * such as Codex, or a test double is used.
 */
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const cp = require('node:child_process');
const { checkAnswer, PROMPTS } = require('./agent-answer.cjs');

const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const number = (name, fallback) => { const n = Number(process.env[name]); return Number.isFinite(n) && n > 0 ? n : fallback; };
const pragueDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const json = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const save = (file, value) => { fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 1)); fs.renameSync(`${file}.tmp`, file); };

/** May a run start now? Once a day, unless a person asks for it. */
function mayRun(state, { now = new Date(), force = false } = {}) {
  if (force) return { ok: true };
  if (state.lastRunDay === pragueDay(now)) return { ok: false, why: `already ran today (${state.lastRunDay})` };
  return { ok: true };
}
/** Signs that asking again would only spend more or fail the same way. */
const cannotWork = text => /ENOENT|command not found|not logged in|please run \/login|usage limit|rate limit|limit reached|credit balance|quota/i.test(text);

function ask(prompt, directory, { seconds, usd, model }) {
  // Only what the tool needs to find its sign-in; nothing of the project's.
  const env = { HOME: os.homedir(), PATH: process.env.PATH ?? '', USER: process.env.USER ?? '', LOGNAME: process.env.LOGNAME ?? process.env.USER ?? '', LC_ALL: 'en_US.UTF-8', TMPDIR: process.env.TMPDIR ?? os.tmpdir() };
  const custom = process.env.AGENT_CMD;
  // Started by the Mac's runner there is no shell profile, so the usual place is looked in as well.
  const claude = process.env.AGENT_CLAUDE_BIN ?? [path.join(os.homedir(), '.local/bin/claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'].find(candidate => fs.existsSync(candidate)) ?? 'claude';
  const [file, args] = custom ? ['/bin/sh', ['-c', custom]] : [claude, ['-p', '--model', model, '--tools', 'WebFetch,WebSearch,Read', '--allowedTools', 'WebFetch WebSearch Read',
    '--strict-mcp-config', '--disable-slash-commands', '--setting-sources', 'local', '--no-session-persistence', '--no-chrome', '--output-format', 'json', '--max-budget-usd', String(usd)]];
  const started = Date.now();
  const ran = cp.spawnSync(file, args, { cwd: directory, env, input: prompt, encoding: 'utf8', timeout: seconds * 1000, killSignal: 'SIGKILL', maxBuffer: 2 ** 24 });
  const timedOut = ran.error?.code === 'ETIMEDOUT';
  let text = ran.stdout ?? '', usdSpent = null, turns = null;
  try { const reply = JSON.parse(text); if (reply && typeof reply === 'object' && 'result' in reply) { text = String(reply.result ?? ''); usdSpent = reply.total_cost_usd ?? null; turns = reply.num_turns ?? null; } } catch { /* A plain-text tool answers in plain text. */ }
  return { text, timedOut, code: ran.status, stderr: `${ran.error && !timedOut ? ran.error.message : ''}${ran.stderr ?? ''}`.slice(-400), seconds: Math.round((Date.now() - started) / 100) / 10, usd: usdSpent, turns };
}

function main() {
  const cases = arg('cases'), out = arg('out'); if (!cases || !out) throw Error('--cases=<dir> and --out=<dir> are needed');
  fs.mkdirSync(out, { recursive: true });
  const stateFile = path.join(out, 'agent-state.json'); const state = json(stateFile, {});
  const allowed = mayRun(state, { force: process.argv.includes('--force') });
  if (!allowed.ok) { console.log(JSON.stringify({ ran: false, why: allowed.why })); return; }
  const limits = { max: Number(arg('max') ?? 20), seconds: number('AGENT_CASE_SECONDS', 240), usd: number('AGENT_CASE_USD', 0.4), runUsd: number('AGENT_RUN_USD', 4), model: process.env.AGENT_MODEL ?? 'sonnet' };
  const todo = json(path.join(cases, 'index.json'), []).filter(item => (!arg('kind') || item.kind === arg('kind')) && PROMPTS[item.kind] && !fs.existsSync(path.join(out, `${item.case}.json`))).slice(0, limits.max);
  // The day is spent as soon as a run starts, so a crash halfway cannot become a second run.
  state.lastRunDay = pragueDay(); state.lastRunAt = new Date().toISOString(); save(stateFile, state);
  const run = { at: state.lastRunAt, limits, asked: 0, answered: 0, refused: 0, timedOut: 0, usd: 0, seconds: 0, stopped: null };
  for (const item of todo) {
    if (run.usd >= limits.runUsd) { run.stopped = 'run budget spent'; break; }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'letsrace-agent-'));
    try {
      const body = json(path.join(cases, `${item.case}.json`), null); if (!body) continue;
      fs.writeFileSync(path.join(directory, 'case.json'), JSON.stringify(body, null, 1));
      const reply = ask(`${PROMPTS[item.kind]}\n\nThe case is in the file case.json in the current directory. Read it first.`, directory, limits);
      run.asked++; run.seconds += reply.seconds; run.usd += reply.usd ?? 0;
      if (cannotWork(`${reply.text}\n${reply.stderr}`)) { run.stopped = `the agent cannot work: ${(reply.text || reply.stderr).trim().slice(0, 120)}`; break; }
      const checked = reply.timedOut ? { ok: false, why: 'time limit' } : checkAnswer(item.kind, body, reply.text);
      if (reply.timedOut) run.timedOut++; else if (checked.ok) run.answered++; else run.refused++;
      save(path.join(out, `${item.case}.json`), { case: item.case, kind: item.kind, at: new Date().toISOString(), seconds: reply.seconds, usd: reply.usd, turns: reply.turns,
        ...(checked.ok ? { answer: checked.answer } : { refused: checked.why, raw: reply.text.slice(0, 2000) }) });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }
  run.usd = Math.round(run.usd * 1000) / 1000; run.seconds = Math.round(run.seconds);
  // A run in which the agent could not work at all spent nothing: the day stays free for a real one.
  if (run.stopped?.startsWith('the agent cannot work') && !(run.answered + run.refused + run.timedOut)) delete state.lastRunDay;
  state.runs = [...(state.runs ?? []), run].slice(-60); save(stateFile, state);
  console.log(JSON.stringify({ ran: true, ...run }));
}
module.exports = { mayRun, cannotWork, pragueDay };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
