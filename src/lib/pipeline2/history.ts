/**
 * One row a day of the numbers version 2 is judged by, so a week from now there is something
 * to compare with. The day's row is rewritten until the day is over; nothing older is touched.
 * See docs/pipeline-v2.md, "Jak poznáme, že verze 2 funguje".
 */
import type { PipelineSummary } from "@/lib/pipeline2/status";

export type GateCounts = { applied: number; held: number; rejected: number; superseded: number; rolledBack: number };
export type AgentCounts = { answers: number; verified: number; unverified: number; undecided: number };
export type DayRow = {
  day: string;
  newRaces: number;
  updatedRaces: number;
  cycles: number;
  /** Races the cycle holds back from the catalogue, at the day's last cycle. */
  heldRaces: number | null;
  /** Steps whose latest attempt failed or timed out; of them, stopped after five failures. */
  failingSteps: number;
  stoppedSteps: number;
  /** Steps waiting on something outside us: a shut website, a spent AI allowance. */
  waitingSteps: number;
  aiUsd: number | null;
  editionsFound: number | null;
  gate: GateCounts | null;
  agent: AgentCounts | null;
};

/** Today's row from the summary and what the gate and the agent's desk hold. */
export function dayRow(day: string, summary: PipelineSummary, extra: { gate?: GateCounts | null; agent?: AgentCounts | null } = {}): DayRow {
  const failing = summary.stuck.filter(step => step.outcome === "failed" || step.outcome === "timeout");
  return {
    day,
    newRaces: summary.delivered.newRaces24h,
    updatedRaces: summary.delivered.updatedRaces24h,
    cycles: summary.mac.cycles24h,
    heldRaces: summary.heldRaces,
    failingSteps: failing.length,
    stoppedSteps: failing.filter(step => step.stopped).length,
    waitingSteps: summary.stuck.length - failing.length,
    aiUsd: summary.ai.spentTodayUsd,
    editionsFound: summary.coverage?.withEdition ?? null,
    gate: extra.gate ?? null,
    agent: extra.agent ?? null,
  };
}

/** The history with today's row put in its place; 400 days are kept. */
export function withDay(history: DayRow[], row: DayRow): DayRow[] {
  // A number that could not be read today keeps the day's earlier reading instead of turning into "unknown".
  const earlier = history.find(item => item.day === row.day);
  const merged = earlier ? { ...row, gate: row.gate ?? earlier.gate, agent: row.agent ?? earlier.agent, heldRaces: row.heldRaces ?? earlier.heldRaces } : row;
  return [...history.filter(item => item.day !== row.day), merged].sort((a, b) => a.day.localeCompare(b.day)).slice(-400);
}

/** The last days as lines of text, newest last. */
export function historyTable(history: DayRow[], days = 14): string[] {
  const show = (value: number | null | undefined) => value == null ? "–" : String(value);
  const head = "den         nové  dopl.  zadrž.  selhává  čeká  brána přijala/zadržela/vrátila  agent ověřeno/neověřeno  AI USD";
  return [head, ...history.slice(-days).map(row => [
    row.day, show(row.newRaces).padStart(5), show(row.updatedRaces).padStart(6), show(row.heldRaces).padStart(7),
    `${row.failingSteps}${row.stoppedSteps ? ` (${row.stoppedSteps} zast.)` : ""}`.padStart(8), show(row.waitingSteps).padStart(5),
    (row.gate ? `${row.gate.applied}/${row.gate.held}/${row.gate.rolledBack}` : "–").padStart(31),
    (row.agent ? `${row.agent.verified}/${row.agent.unverified}` : "–").padStart(24), (row.aiUsd == null ? "–" : row.aiUsd.toFixed(2)).padStart(7),
  ].join(" "))];
}
