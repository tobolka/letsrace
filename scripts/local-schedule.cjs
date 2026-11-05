/**
 * When the Mac's next cycle starts. Reading happens here, so neither server's limits decide
 * the pace: work left means carry on straight away, and otherwise wait for the next thing
 * that falls due. A cycle that achieved nothing must not spin, and a broken one backs off.
 */
const MINUTE = 60_000, HOUR = 60 * MINUTE;
const CARRY_ON_MS = 30_000;
const SHORTEST_WAIT_MS = MINUTE;
const LONGEST_WAIT_MS = 6 * HOUR;

function failureDelay(failures) {
  return Math.min(HOUR, 5 * MINUTE * 2 ** Math.max(0, failures - 1));
}

/** True when this finished cycle counts as broken: nothing reported, or a step stopped it. */
function cycleFailed(result, exitCode) {
  return !result || Boolean(result.error) || ![0, 1, 2].includes(exitCode);
}

function nextRunAt({ now, result, exitCode, failures = 0 }) {
  if (cycleFailed(result, exitCode)) return now + failureDelay(Math.max(1, failures));
  if (result.moreWork) return now + CARRY_ON_MS;
  const due = Date.parse(result.nextWorkAt ?? '');
  return now + Math.min(LONGEST_WAIT_MS, Math.max(SHORTEST_WAIT_MS, Number.isFinite(due) ? due - now : LONGEST_WAIT_MS));
}

module.exports = { nextRunAt, cycleFailed, failureDelay, CARRY_ON_MS, SHORTEST_WAIT_MS, LONGEST_WAIT_MS };
