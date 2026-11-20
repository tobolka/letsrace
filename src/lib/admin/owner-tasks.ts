/**
 * What needs the owner, and nothing else.
 *
 * The admin used to show every queue the machines keep: website suggestions,
 * sources that could not be read yet, possible duplicates. Those are the
 * machines' work, and they read as alarms. This list holds only what a machine
 * cannot do: switch on the Mac, start the agent, answer a person who wrote in,
 * answer a question the pipeline asked. Each task says in one sentence what
 * happened and in one sentence what to do.
 *
 * The same list is sent by e-mail (`owner-mail.ts`), so the owner does not have
 * to come and look.
 */
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export type OwnerTask = {
  /** Stable while the situation lasts; the e-mail uses it not to repeat itself. */
  key: string;
  title: string;
  what: string;
  todo: string;
  link?: { href: string; label: string };
};

export type OwnerTaskInput = {
  now: number;
  macAt: string | null;
  macPaused: boolean;
  agent: { open: number; lastAnswerAt: number | null } | null;
  serverAt: string | null;
  messages: number;
  questions: number;
};

const HOUR = 3_600_000;
const MAC_SILENT_AFTER = 6 * HOUR;
const SERVER_STALE_AFTER = 36 * HOUR;
const AGENT_IDLE_AFTER = 3 * 24 * HOUR;

export function formatPrague(at: number | string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

const age = (now: number, at: string | number | null) => (at == null ? Infinity : now - (typeof at === "number" ? at : Date.parse(at)));

export function ownerTasks(input: OwnerTaskInput): OwnerTask[] {
  const tasks: OwnerTask[] = [];
  const macSilent = age(input.now, input.macAt) > MAC_SILENT_AFTER;

  if (macSilent) {
    tasks.push({
      key: "mac-silent",
      title: "Mac se neozývá",
      what: input.macAt
        ? `Poslední hlášení z Macu přišlo ${formatPrague(input.macAt)}. Bez něj se nečtou weby pořadatelů a nepřibývají nové závody.`
        : "Z Macu zatím nepřišlo žádné hlášení. Bez něj se nečtou weby pořadatelů a nepřibývají nové závody.",
      todo: "Zapni nebo probuď Mac a připoj ho k internetu. Sběr se pak spustí sám, nic dalšího nedělej.",
    });
  } else if (input.macPaused) {
    tasks.push({
      key: "mac-paused",
      title: "Sběr na Macu je pozastavený",
      what: "Mac běží, ale sběr je pozastavený, takže se nečtou weby pořadatelů.",
      todo: "Pokud jsi ho nepozastavil schválně, klikni na Macu v liště na ikonu LetsRace a pak na „Obnovit sběr“.",
    });
  }

  if (age(input.now, input.serverAt) > SERVER_STALE_AFTER) {
    tasks.push({
      key: "server-stale",
      title: "Denní úlohy na serveru neběží",
      what: input.serverAt
        ? `Poslední denní úloha serveru doběhla ${formatPrague(input.serverAt)}. Mají běžet každé ráno.`
        : "Server zatím nemá žádnou doběhlou denní úlohu.",
      todo: "Otevři Claude Code v projektu letsrace a napiš: „Denní úlohy serveru LetsRace neběží, zjisti proč a oprav to.“",
    });
  }

  // Only with a fresh Mac: a silent Mac cannot say anything about the agent.
  if (!macSilent && input.agent && input.agent.open > 0 && age(input.now, input.agent.lastAnswerAt) > AGENT_IDLE_AFTER) {
    tasks.push({
      key: "agent-idle",
      title: "Agent nepracuje",
      what: `Na agenta čeká ${input.agent.open} úkolů (posoudit nové weby, najít propozice, rozhodnout duplicity)${
        input.agent.lastAnswerAt ? `, naposledy odpověděl ${formatPrague(input.agent.lastAnswerAt)}` : ", zatím neodpověděl ani jednou"
      }.`,
      todo: "Otevři Codex v projektu letsrace a napiš: „Spusť agenta race-finder a zpracuj frontu na přepážce.“",
    });
  }

  if (input.messages > 0) {
    tasks.push({
      key: "messages",
      title: input.messages === 1 ? "Napsal ti uživatel" : `Napsali ti uživatelé (${input.messages})`,
      what: "Lidé poslali připomínku nebo tip na závod. Na to automat neodpovídá.",
      todo: "Otevři Zprávy, přečti je a odpověz nebo je označ jako vyřízené.",
      link: { href: "/admin/inbox", label: "Otevřít zprávy" },
    });
  }

  if (input.questions > 0) {
    tasks.push({
      key: "questions",
      title: input.questions === 1 ? "Systém se tě ptá" : `Systém se tě ptá (${input.questions}×)`,
      what: "Je potřeba rozhodnutí, které automat udělat nesmí.",
      todo: "Odpověz jedním kliknutím u otázky níže. Když neodpovíš, platí uvedené výchozí řešení.",
      link: { href: "/admin#otazky", label: "Ukázat otázky" },
    });
  }

  return tasks;
}

const agentSummary = z.object({ open: z.number().int().min(0), lastAnswerAt: z.number().nullable() });

export async function getOwnerTaskInput(now = Date.now()): Promise<OwnerTaskInput> {
  const db = createServerSupabase();
  const [mac, server, feedback, submissions, questions] = await Promise.all([
    db.from("pipeline_workers").select("heartbeat_at,paused,summary").eq("key", "mac").maybeSingle(),
    // Any daily server job that finished: the source reading itself moved to the Mac on 5 Nov 2026.
    db.from("pipeline_jobs").select("finished_at").not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("feedback_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("race_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("pipeline_owner_decisions").select("key", { count: "exact", head: true }).eq("status", "open"),
  ]);
  for (const result of [mac, server, feedback, submissions, questions]) {
    if (result.error) throw Error(`Reading owner tasks: ${result.error.message}`);
  }
  const summary = mac.data?.summary as { agent?: unknown } | null | undefined;
  const agent = agentSummary.safeParse(summary?.agent);
  return {
    now,
    macAt: mac.data?.heartbeat_at ?? null,
    macPaused: mac.data?.paused ?? false,
    agent: agent.success ? agent.data : null,
    serverAt: server.data?.finished_at ?? null,
    messages: (feedback.count ?? 0) + (submissions.count ?? 0),
    questions: questions.count ?? 0,
  };
}

export async function getOwnerTasks(now = Date.now()) {
  const input = await getOwnerTaskInput(now);
  return { input, tasks: ownerTasks(input) };
}
