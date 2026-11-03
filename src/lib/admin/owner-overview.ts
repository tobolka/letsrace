import { createServerSupabase } from "@/lib/supabase/server";
import { getPipelineSourceCounts } from "@/lib/pipeline/source-counts";
import { z } from "zod";

const publicationCounts = z.object({ seriesAwaitingRequest: z.number().int().nonnegative(), awaitingRequest: z.number().int().nonnegative(), requestedAwaitingCheck: z.number().int().nonnegative(), awaitingCheck: z.number().int().nonnegative() });
const catalogueCheck = z.object({ verifiedAt: z.iso.datetime({ offset: true }), races: z.number().int().nonnegative() });

export type OwnerStateInput = {
  now: number; macAt: string | null; macPaused: boolean; macStatus: string | null;
  serverAt: string | null; serverStatus?: string; broken: number; unreadable: number; candidates: number; publicationPending: number;
  newSourceLeads:number;sourceReview:number;sourceDeferred:number;overdueSources:number;
};
export function ownerState(input: OwnerStateInput) {
  const fresh = (at: string | null, age: number) => at != null && Date.parse(at) <= input.now + 60000 && Date.parse(at) > input.now - age;
  const mac = fresh(input.macAt, 15 * 60000), server = fresh(input.serverAt, 36 * 3600000);
  if (!mac && !server) return { tone: "warning", title: "Provoz teď není potvrzený", detail: "Chybí čerstvé hlášení Macu i dokončená serverová kontrola. Poslední známé údaje nejsou potvrzením, že vše běží." };
  if (!mac) return { tone: "warning", title: "Mac se nehlásí", detail: "Serverová kontrola je zaznamenaná. Místní sběr teď není potvrzený; Mac může být vypnutý nebo bez připojení." };
  if (input.macPaused) return { tone: "muted", title: "Sběr na Macu je pozastavený", detail: "Pauza platí pouze pro Mac. Serverová část tím není pozastavená." };
  if (!server) return { tone: "warning", title: "Serverová kontrola není čerstvá", detail: "Mac se hlásí, ale poslední dokončená serverová kontrola je stará nebo chybí." };
  if (!["running", "waiting", "quiet", "attention"].includes(input.macStatus ?? "") || !["ok", "limited", "error", "attention", "deferred"].includes(input.serverStatus ?? "")) return { tone: "warning", title: "Výsledek provozu není potvrzený", detail: "Hlášení dorazilo, ale neobsahuje rozpoznaný výsledek. Samotný čas hlášení neznamená úspěšnou kontrolu." };
  if (input.macStatus === "attention" || ["error","attention","deferred"].includes(input.serverStatus ?? "")) return { tone: "warning", title: "Část poslední kontroly zůstala nedokončená", detail: "Uložené výsledky zůstávají zachované. Omezení nebo chyba se řeší v další práci systému, nikoli opakovaným ručním spouštěním." };
  if (input.broken > 0 || input.macStatus === "quiet") return { tone: "warning", title: "Sběr pokračuje s omezením", detail: "Část práce potřebuje opravu nebo další pokus. Nepřečtené stránky a skutečné chyby jsou níže uvedené zvlášť." };
  if (input.serverStatus === "limited" || input.candidates || input.unreadable || input.publicationPending || input.newSourceLeads || input.sourceReview || input.sourceDeferred || input.overdueSources) return { tone: "warning", title: "Sběr běží, část práce ještě čeká", detail: "Probíhají pravidelné kontroly. Čekající ověření a změny zatím nepovažuji za hotové; nemusíš vybírat jednotlivé sběrače." };
  return { tone: "good", title: input.macStatus === "running" ? "Právě probíhá sběr" : "Běžné kontroly se spouštějí samy", detail: "Mac se hlásí a serverová kontrola je zaznamenaná. Tyto údaje potvrzují provoz, ne úplnost ani správnost všech závodů." };
}

export async function getOwnerOverview(decisionOffset=0) {
  const db = createServerSupabase(), now = Date.now();
  const [mac, server, sources, links, candidates, scheduled, publication, checked, oldest, questions, answered, catalogue, refreshCounts] = await Promise.all([
    db.from("pipeline_workers").select("*").eq("key", "mac").maybeSingle(),
    db.from("pipeline_jobs").select("*").eq("key", "server-free").maybeSingle(),
    getPipelineSourceCounts(),
    db.from("discovered_links").select("id", { head: true, count: "exact" }).eq("status", "pending"),
    db.from("pipeline_candidates").select("id", { head: true, count: "exact" }).in("status", ["pending", "waiting", "conflict", "publishing"]),
    db.from("pipeline_candidates").select("id", { head: true, count: "exact" }).in("status", ["pending", "waiting", "conflict"]).not("decision->followUp->>nextCheckAt", "is", null),
    db.from("pipeline_tasks").select("key", { head: true, count: "exact" }).in("kind", ["public_refresh", "catalogue_refresh"]).in("status", ["pending", "running"]),
    db.from("pipeline_task_attempts").select("token", { head: true, count: "exact" }).eq("kind", "public_refresh").eq("outcome", "done").not("result->>verifiedAt", "is", null).gte("finished_at", new Date(now - 86400000).toISOString()),
    db.from("pipeline_candidates").select("created_at").in("status", ["pending", "waiting", "conflict", "publishing"]).order("created_at").limit(1),
    db.from("pipeline_owner_decisions").select("key,question,reason,recommendation,default_action,options,evidence,updated_at",{count:"exact"}).eq("status","open").order("created_at").order("key").range(decisionOffset,decisionOffset+19),
    db.from("pipeline_owner_decisions").select("key",{count:"exact",head:true}).eq("status","answered"),
    db.from("pipeline_tasks").select("result").eq("key", "catalogue:upcoming").maybeSingle(),
    db.rpc("pipeline_publication_counts"),
  ]);
  for (const result of [mac, server, links, candidates, scheduled, publication, checked, oldest, questions, answered, catalogue, refreshCounts]) if (result.error) throw Error(`Reading owner overview: ${result.error.message}`);
  for(const result of [links,candidates,scheduled,publication,checked,questions,answered])if(typeof result.count!=='number')throw Error('Owner overview count is not confirmed');
  const input: OwnerStateInput = { now, macAt: mac.data?.heartbeat_at ?? null, macPaused: mac.data?.paused ?? false, macStatus: mac.data?.status ?? null,
    serverAt: server.data?.finished_at ?? null,serverStatus:server.data?.status, broken: sources.broken, unreadable: sources.unreadable, candidates: candidates.count ?? 0, publicationPending: publication.count ?? 0,
    newSourceLeads:links.count??0,sourceReview:sources.review,sourceDeferred:sources.deferred,overdueSources:sources.overdue };
  const lastCatalogueCheck = catalogueCheck.safeParse(catalogue.data?.result);
  return { ...input, state: ownerState(input), activeSources: sources.sources, newSourcesWaiting: links.count ?? 0, candidatesScheduled: scheduled.count ?? 0,
    publicationCounts: publicationCounts.parse(refreshCounts.data),
    catalogueCheck: lastCatalogueCheck.success ? lastCatalogueCheck.data : null,
    publicChecks24h: checked.count ?? 0, oldestCandidate: oldest.data?.[0]?.created_at ?? null, mac: mac.data, server: server.data,
    questions:questions.data??[],questionCount:questions.count??0,answersWaiting:answered.count??0,decisionOffset };
}
