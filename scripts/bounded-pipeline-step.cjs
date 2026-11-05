/** Bound one resumable pipeline phase, including descendants; a time limit is deferred work. */
const { spawn } = require('node:child_process');
const [seconds, file, ...args] = process.argv.slice(2);
const limit = Number(seconds);
if (!Number.isFinite(limit) || limit <= 0 || !file) {
  console.error('Expected seconds and a command'); process.exit(1);
}
const child = spawn(file, args, { stdio: 'inherit', detached: true, env: process.env });
let expired = false, closing = false, force;
const stop = signal => {
  if (closing) return;
  closing = true;
  try { process.kill(-child.pid, signal); } catch { /* Already finished. */ }
  force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000);
  force.unref();
};
const timer = setTimeout(() => { expired = true; stop('SIGTERM'); }, limit * 1000);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
child.on('error', error => { console.error(error.message); clearTimeout(timer); process.exitCode = 1; });
child.on('close', code => {
  clearTimeout(timer); clearTimeout(force);
  if (expired) console.info('pipeline_step_deferred', JSON.stringify({ reason: 'phase_time_budget', seconds: limit }));
  process.exitCode = expired ? 2 : code ?? 1;
});
