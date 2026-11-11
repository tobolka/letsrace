/** Bound one resumable pipeline phase, including descendants; a time limit is deferred work. */
const { spawn } = require('node:child_process');
const [seconds, file, ...args] = process.argv.slice(2);
const limit = Number(seconds);
if (!Number.isFinite(limit) || limit <= 0 || !file) {
  console.error('Expected seconds and a command'); process.exit(1);
}
const GRACE_MS = 5000;
const child = spawn(file, args, { stdio: 'inherit', detached: true, env: process.env });
let expired = false, closing = false, stoppedAt = 0;
const signalGroup = signal => { try { process.kill(-child.pid, signal); return true; } catch { return false; } };
const stop = signal => {
  if (closing) return;
  closing = true; stoppedAt = Date.now();
  signalGroup(signal);
};
const timer = setTimeout(() => { expired = true; stop('SIGTERM'); }, limit * 1000);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
child.on('error', error => { console.error(error.message); clearTimeout(timer); process.exitCode = 1; });
/**
 * The command started here is usually a thin wrapper, and the work is done by a process it
 * started. The wrapper dies at the first signal; the worker may be finishing a page and take the
 * signal as a request. Leaving then would cancel the forced stop and leave the worker running
 * with our output open, which held a whole cycle for sixteen minutes on 9 Nov 2026. So wait for
 * the whole group, and end it when the grace is over.
 */
function leaveWhenGroupIsGone(code) {
  const finish = () => {
    if (expired) console.info('pipeline_step_deferred', JSON.stringify({ reason: 'phase_time_budget', seconds: limit }));
    process.exit(expired ? 2 : code ?? 1);
  };
  if (!closing) return finish();
  const check = () => {
    if (!signalGroup(0)) return finish();
    if (Date.now() - stoppedAt >= GRACE_MS) { signalGroup('SIGKILL'); return finish(); }
    setTimeout(check, 100);
  };
  check();
}
child.on('close', code => { clearTimeout(timer); leaveWhenGroupIsGone(code); });
