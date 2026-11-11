/**
 * One honest summary of the Mac pipeline, put together from what its cycles saved.
 * Nothing here is written by a worker as "the status": it is always derived, so the Mac and a
 * second worker can never overwrite each other's view. See docs/pipeline-v2.md, part 9.
 */

export type StepOutcome = "done" | "partial" | "timeout" | "blocked" | "waiting" | "failed";
export type StepEnd = {
  outcome: StepOutcome;
  reason: string | null;
  /** Failures in a row so far, when this attempt was one. */
  failures?: number;
  /** When the step may try again after this attempt. */
  nextTryAt?: string;
  /** Five failures in a row: tried only once a week until it works. */
  stopped?: boolean;
  /** The time limit ran out while the Mac slept; not counted against the step. */
  slept?: boolean;
};

/** The fields of a cycle's result.json this summary reads; everything else is ignored. */
export type CycleResult = {
  startedAt?: string;
  finishedAt?: string;
  state?: string;
  error?: string;
  publishedNewRaces?: number;
  updatedRaces?: number;
  heldRaces?: number;
  readSources?: number;
  sourceFailures?: number;
  steps?: Record<string, StepEnd>;
  /** Cycles before 11 Nov 2026 only kept these strings. */
  upkeep?: Record<string, string>;
  coverage?: { season: number; races: number; withEdition: number } | null;
};

export type StepSummary = {
  step: string;
  last: StepEnd & { at: string };
  /** Attempts in the last 24 hours by how they ended. */
  day: Partial<Record<StepOutcome, number>>;
  lastDoneAt: string | null;
};

export type Tone = "green" | "yellow" | "orange" | "red";

export type PipelineSummary = {
  at: string;
  tone: Tone;
  headline: string;
  mac: { lastReportAt: string | null; reportAgeMinutes: number | null; lastCycleAt: string | null; cycles24h: number };
  delivered: { newRaces24h: number; newRaces7d: number; updatedRaces24h: number; updatedRaces7d: number };
  heldRaces: number | null;
  coverage: CycleResult["coverage"];
  ai: { spentTodayUsd: number | null; spentMonthUsd: number | null };
  steps: StepSummary[];
  /** Steps whose latest attempt did not finish, worst first. */
  stuck: { step: string; outcome: StepOutcome; reason: string | null; since: string; attempts24h: number; failures?: number; nextTryAt?: string; stopped?: boolean }[];
};

const HOUR = 3_600_000;
/** The runner writes monitor.json every few seconds; this long without it means it is not running. */
const MAC_SILENT_AFTER_MS = HOUR / 2;

/** What a cycle saved about one step, whichever way that cycle wrote it down. */
export function stepsOf(result: CycleResult): Record<string, StepEnd> {
  if (result.steps) return result.steps;
  const steps: Record<string, StepEnd> = {};
  for (const [step, text] of Object.entries(result.upkeep ?? {})) steps[step] = legacyStep(text);
  return steps;
}

/**
 * The old strings. "deferred" there meant exit 2, which was a step stopping at its own budget and
 * also a step cut off from outside; which of the two is not recorded, so it stays "partial" with
 * that said in the reason. A failure with exit 1 carries no cause either.
 */
function legacyStep(text: string): StepEnd {
  if (text === "done") return { outcome: "done", reason: null };
  if (text === "deferred") return { outcome: "partial", reason: "own_budget_or_timeout" };
  if (text === "timeout") return { outcome: "timeout", reason: "timeout" };
  if (text.startsWith("waiting")) return { outcome: "waiting", reason: "ai_budget" };
  if (text.startsWith("blocked: ")) return { outcome: "blocked", reason: text.slice(9) };
  if (text.includes("časový limit")) return { outcome: "timeout", reason: "timeout" };
  const exit = text.match(/: (\d+)$/);
  return { outcome: "failed", reason: exit ? `exit_${exit[1]}` : "unknown" };
}

const sum = (rows: CycleResult[], key: "publishedNewRaces" | "updatedRaces") => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const WORST: StepOutcome[] = ["failed", "timeout", "blocked", "waiting", "partial", "done"];

export function summarise(input: {
  cycles: CycleResult[];
  now: Date;
  /** `at` of the runner's monitor.json. */
  macReportAt?: string | null;
  aiLedger?: { days?: Record<string, number>; months?: Record<string, number> } | null;
  /** The day the ledger counts by, in Prague. */
  aiDay?: string;
}): PipelineSummary {
  const now = input.now.getTime();
  const cycles = input.cycles.filter(c => c.startedAt && Number.isFinite(Date.parse(c.startedAt))).sort((a, b) => a.startedAt!.localeCompare(b.startedAt!));
  const since = (ms: number) => cycles.filter(c => now - Date.parse(c.startedAt!) <= ms);
  const day = since(24 * HOUR), week = since(7 * 24 * HOUR);
  const last = cycles.at(-1) ?? null;

  const byStep = new Map<string, StepSummary>();
  for (const cycle of cycles) {
    const recent = now - Date.parse(cycle.startedAt!) <= 24 * HOUR;
    for (const [step, end] of Object.entries(stepsOf(cycle))) {
      const held = byStep.get(step) ?? { step, last: { ...end, at: cycle.startedAt! }, day: {}, lastDoneAt: null };
      held.last = { ...end, at: cycle.startedAt! };
      if (recent) held.day[end.outcome] = (held.day[end.outcome] ?? 0) + 1;
      if (end.outcome === "done" || end.outcome === "partial") held.lastDoneAt = cycle.startedAt!;
      byStep.set(step, held);
    }
  }
  const steps = [...byStep.values()].sort((a, b) => WORST.indexOf(a.last.outcome) - WORST.indexOf(b.last.outcome) || a.step.localeCompare(b.step));
  const stuck = steps.filter(s => !["done", "partial"].includes(s.last.outcome)).map(s => {
    // Since when: the first of the unbroken run of attempts that ended this way.
    let from = s.last.at;
    for (let i = cycles.length - 1; i >= 0; i--) {
      const end = stepsOf(cycles[i])[s.step];
      if (!end) continue;
      if (end.outcome !== s.last.outcome) break;
      from = cycles[i].startedAt!;
    }
    return {
      step: s.step, outcome: s.last.outcome, reason: s.last.reason, since: from, attempts24h: s.day[s.last.outcome] ?? 0,
      ...(s.last.failures ? { failures: s.last.failures } : {}), ...(s.last.nextTryAt ? { nextTryAt: s.last.nextTryAt } : {}), ...(s.last.stopped ? { stopped: true } : {}),
    };
  });

  const reportAge = input.macReportAt && Number.isFinite(Date.parse(input.macReportAt)) ? now - Date.parse(input.macReportAt) : null;
  // A limit that ran out while the Mac slept says nothing about the step.
  const broken = stuck.filter(s => s.outcome === "failed" || (s.outcome === "timeout" && !byStep.get(s.step)?.last.slept));
  const stopped = broken.filter(s => s.stopped);
  const outside = stuck.filter(s => s.outcome === "blocked" || s.outcome === "waiting");
  const names = (rows: { step: string }[]) => rows.map(r => r.step).join(", ");
  let tone: Tone, headline: string;
  if (reportAge == null || reportAge > MAC_SILENT_AFTER_MS) {
    tone = "red"; headline = reportAge == null ? "Sběr na Macu se nehlásí" : `Sběr na Macu se ${Math.round(reportAge / 60_000)} minut neozval`;
  } else if (last?.error) {
    tone = "orange"; headline = `Poslední průchod skončil chybou: ${last.error.slice(0, 120)}`;
  } else if (broken.length) {
    tone = "orange"; headline = stopped.length ? `Zastavené kroky: ${names(stopped)}` : `Nedokončené kroky: ${names(broken)}`;
  } else if (outside.length) {
    tone = "yellow"; headline = `Čeká na okolnosti mimo nás: ${names(outside)}`;
  } else {
    // Green does not need work done: a day with nothing due is a healthy day.
    tone = "green"; headline = day.length ? "Vše dobíhá" : "Nic nebylo splatné";
  }

  const aiDay = input.aiDay ?? input.now.toISOString().slice(0, 10);
  return {
    at: input.now.toISOString(),
    tone,
    headline,
    mac: {
      lastReportAt: input.macReportAt ?? null,
      reportAgeMinutes: reportAge == null ? null : Math.round(reportAge / 60_000),
      lastCycleAt: last?.finishedAt ?? last?.startedAt ?? null,
      cycles24h: day.length,
    },
    delivered: {
      newRaces24h: sum(day, "publishedNewRaces"), newRaces7d: sum(week, "publishedNewRaces"),
      updatedRaces24h: sum(day, "updatedRaces"), updatedRaces7d: sum(week, "updatedRaces"),
    },
    heldRaces: last?.heldRaces ?? null,
    coverage: [...cycles].reverse().find(c => c.coverage)?.coverage ?? null,
    ai: {
      spentTodayUsd: input.aiLedger ? input.aiLedger.days?.[aiDay] ?? 0 : null,
      spentMonthUsd: input.aiLedger ? input.aiLedger.months?.[aiDay.slice(0, 7)] ?? 0 : null,
    },
    steps,
    stuck,
  };
}
