/**
 * What is waiting for a person after a cycle, and how long the oldest of it has waited.
 *
 * A held race whose only reason is a day already gone needs no decision: nobody will publish a
 * race that is over. It is counted apart so it does not hide the races someone has to look at.
 * Age is kept in the cycle's state, keyed by race, and forgotten when the race stops being held.
 */
const DAY_MS = 86_400_000;
/** Reasons that need nobody's decision. */
const NO_DECISION = new Set(['no_future_date']);

/**
 * @param {string[]} lines the plan's held-for-review.ndjson, one change per line
 * @param {Record<string,string>} since race id → ISO time it was first seen held
 * @param {number} now
 */
function summarizeHeld(lines, since = {}, now = Date.now()) {
  const reasons = new Map();
  for (const line of lines) {
    if (!line) continue;
    const change = JSON.parse(line);
    if (change.tab !== 'public.events') continue;
    const list = reasons.get(change.pk.id) ?? new Set();
    for (const reason of change.heldBecause ?? []) list.add(reason);
    reasons.set(change.pk.id, list);
  }
  const next = {};
  let actionable = 0, past = 0, oldest = null;
  for (const [id, list] of reasons) {
    if (list.size && [...list].every(reason => NO_DECISION.has(reason))) { past++; continue; }
    actionable++;
    next[id] = since[id] ?? new Date(now).toISOString();
    if (oldest == null || Date.parse(next[id]) < Date.parse(oldest)) oldest = next[id];
  }
  return {
    actionable, past, since: next,
    oldestSince: oldest,
    oldestDays: oldest ? Math.floor((now - Date.parse(oldest)) / DAY_MS) : 0,
  };
}

module.exports = { summarizeHeld };
