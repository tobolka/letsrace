/**
 * Run the normal source reader in parallel against the Mac's copy. Start it through
 * scripts/local-run.sh, which points everything at the copy and installs the guard.
 *
 *   bash scripts/local-run.sh node scripts/local-parallel.cjs [--workers=6] [--all] [--limit=24] [--seconds=240] [--max-minutes=120]
 *
 * --all marks every active source as due. A crashed worker is restarted, a stuck one
 * is replaced, and when memory runs short workers pause rather than the Mac suffering.
 */
const { spawn, execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync, createWriteStream, renameSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { homedir } = require('node:os');

const arg = (name, fallback) => {
  const value = process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  return value === undefined ? fallback : Number(value);
};
if (!/^http:\/\/127\.0\.0\.1:/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  console.error('Start this through scripts/local-run.sh');
  process.exit(78);
}

const WORKERS = arg('workers', 6), LIMIT = arg('limit', 24), SECONDS = arg('seconds', 240), MAX_MS = arg('max-minutes', 120) * 60_000;
const QUIET_MS = (SECONDS + 180) * 1000, MAX_RESTARTS = 5, MAX_RUNS = 6;
const LOW_GB = arg('low-memory-gb', 1.2), OK_GB = arg('ok-memory-gb', 2.5);
const home = join(homedir(), 'Library', 'Application Support', 'LetsRace', 'data', 'local-pass-run');
mkdirSync(join(home, 'logs'), { recursive: true });
const PSQL = `${process.env.LOCAL_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin'}/psql`;
const query = sql => execFileSync(PSQL, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace', '-qAt', '-c', sql], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }).trim();
const due = () => Number(query("select count(*) from public.watched_urls where status = 'active' and next_poll_at <= now() and url not ilike '%portal.czechcyclingfederation.com/Races%'"));

function freeMemoryGb() {
  const output = execFileSync('/usr/bin/vm_stat', { encoding: 'utf8' });
  const pages = name => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(output)?.[1] ?? 0);
  return (pages('Pages free') + pages('Pages inactive') + pages('Pages speculative')) * 16384 / 1024 ** 3;
}

const started = Date.now();
const workers = Array.from({ length: WORKERS }, (_, index) => ({ index, child: null, paused: false, restarts: 0, runs: 0, reads: 0, lastOutput: 0, done: false }));
let stopping = false, pausedForMemory = 0;

function launch(worker) {
  const log = createWriteStream(join(home, 'logs', `worker-${worker.index}.log`), { flags: 'a' });
  const child = spawn(process.execPath, ['scripts/with-node.cjs', './node_modules/tsx/dist/cli.mjs', 'scripts/reload-calendars.ts', '--rounds=40', `--limit=${LIMIT}`, `--seconds=${SECONDS}`], {
    env: { ...process.env, LOCAL_WORKER_SHARD: `${worker.index}/${WORKERS}`, LOCAL_CHROME_SLOTS_DIR: join(home, 'chrome-slots'), LOCAL_CHROME_SLOTS: process.env.LOCAL_CHROME_SLOTS ?? '3', LOCAL_WORKER_CONCURRENCY: process.env.LOCAL_WORKER_CONCURRENCY ?? '8', SOURCE_DOCUMENT_CACHE_DIR: join(home, 'documents') },
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.child = child; worker.paused = false; worker.lastOutput = Date.now(); worker.runs++; worker.reads = 0;
  const note = chunk => { worker.lastOutput = Date.now(); worker.reads += String(chunk).split('watcher_run_metrics').length - 1; log.write(chunk); };
  child.stdout.on('data', note); child.stderr.on('data', note);
  child.on('close', code => {
    log.end();
    worker.child = null;
    if (stopping) return;
    // 1 and 2 mean a source could not be read or has work left: a normal end of a run.
    if (code !== 0 && code !== 1 && code !== 2) {
      worker.restarts++;
      console.log(`worker ${worker.index} ended with ${code}; restart ${worker.restarts}/${MAX_RESTARTS}`);
      if (worker.restarts >= MAX_RESTARTS) worker.done = true;
    // A run may stop early on deferred work. Its share of the queue goes on until a run
    // reads nothing, or until what remains keeps coming back (a backlog, not new work).
    } else if (!worker.reads || worker.runs >= MAX_RUNS) worker.done = true;
  });
}

const signal = (worker, name) => { if (worker.child) { try { process.kill(-worker.child.pid, name); } catch { /* Already finished. */ } } };

function writeStatus(state, remaining, memory) {
  const file = join(home, 'status.json'), temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify({ state, at: new Date().toISOString(), startedAt: new Date(started).toISOString(), due: remaining, freeMemoryGb: Math.round(memory * 10) / 10, pausedForMemory,
    workers: workers.map(w => ({ index: w.index, running: Boolean(w.child), paused: w.paused, runs: w.runs, restarts: w.restarts, done: w.done, quietSeconds: w.child ? Math.round((Date.now() - w.lastOutput) / 1000) : null })) }, null, 2));
  renameSync(temp, file);
}

function stopAll(name = 'SIGTERM') {
  stopping = true;
  for (const worker of workers) { signal(worker, 'SIGCONT'); signal(worker, name); }
  setTimeout(() => { for (const worker of workers) signal(worker, 'SIGKILL'); }, 15_000).unref();
}
process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());

if (process.argv.includes('--all')) {
  console.log(`Marked ${query("with marked as (update public.watched_urls set next_poll_at = now() - interval '1 minute' where status = 'active' returning 1) select count(*) from marked")} sources as due`);
}

let idleChecks = 0, lastDue = Infinity;
const timer = setInterval(() => {
  if (stopping) {
    if (workers.every(w => !w.child)) { clearInterval(timer); writeStatus('stopped', due(), freeMemoryGb()); console.log('Stopped; the next run continues from here.'); process.exitCode = 2; }
    return;
  }
  const remaining = due(), memory = freeMemoryGb();
  if (Date.now() - started > MAX_MS) { console.log('Time limit reached'); stopAll(); return; }

  // Short of memory: pause one worker at a time. Plenty again: resume one.
  const running = workers.filter(w => w.child && !w.paused);
  if (memory < LOW_GB && running.length > 1) {
    const worker = running.at(-1);
    signal(worker, 'SIGSTOP'); worker.paused = true; pausedForMemory++;
    console.log(`Memory ${memory.toFixed(1)} GB; paused worker ${worker.index}`);
  } else if (memory > OK_GB) {
    const worker = workers.find(w => w.child && w.paused);
    if (worker) { signal(worker, 'SIGCONT'); worker.paused = false; worker.lastOutput = Date.now(); console.log(`Memory ${memory.toFixed(1)} GB; resumed worker ${worker.index}`); }
  }

  for (const worker of workers) {
    if (worker.child && !worker.paused && Date.now() - worker.lastOutput > QUIET_MS) {
      console.log(`worker ${worker.index} has been silent; replacing it`);
      signal(worker, 'SIGKILL');
    }
    // Nothing due and nobody at work: do not start a process just to find that out.
    if (!worker.child && !worker.done && !stopping && remaining > 0) launch(worker);
  }

  // A worker that finished may still have work released by retries; finish when nothing moves.
  // Sources waiting out a crashed worker's lease or a retry should not hold the pass open.
  idleChecks = remaining < lastDue ? 0 : idleChecks + 1;
  lastDue = remaining;
  if (workers.every(w => w.done || !w.child)) {
    if (remaining === 0 || idleChecks > 3) {
      clearInterval(timer);
      writeStatus('finished', remaining, memory);
      console.log(`Finished: ${remaining} sources still due after ${Math.round((Date.now() - started) / 1000)} s`);
      return;
    } else if (workers.every(w => w.done)) {
      // What stays due is waiting out a lease or a retry time; the next pass picks it up.
      clearInterval(timer);
      writeStatus('finished', remaining, memory);
      console.log(`Finished: ${remaining} sources still due after ${Math.round((Date.now() - started) / 1000)} s`);
      return;
    }
  }
  writeStatus('running', remaining, memory);
}, 5000);

mkdirSync(dirname(join(home, 'status.json')), { recursive: true });
for (const worker of workers) launch(worker);
console.log(`Started ${WORKERS} workers, ${due()} sources due; progress in ${join(home, 'status.json')}`);
