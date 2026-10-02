import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { normalizeName } from "@/lib/domain";
import { askJson, SONNET, type LlmUsage, NO_USAGE } from "@/lib/llm/anthropic";

const PAGE = 1000;
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function slugifySeries(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * The series a race name carries, if it carries one: the part before the round
 * or the venue. "GUNSHA Cross Challenge — Borna", "ZH Cross #6",
 * "ProTour Cyclocross Cup — Wyścig 3", "27. Weser-Ems-Cup 26/27 powered by
 * Decathlon - Osnabrück" all name their cup first.
 */
export function seriesPrefix(name: string): string | null {
  let n = name.replace(/\s+/g, " ").trim();
  n = n.split(/\s[—–]\s|\s-\s|:\s/)[0]!;
  n = n
    .replace(/#\s*\d+.*$/, "")
    .replace(/\b(\d+\.?\s*(kolo|z[aá]vod|lauf|runde|round|wy[sś]cig|etap|edycja|edition|stage|prova|tappa|manche))\b.*$/i, "")
    .replace(/\b(round|runde|lauf|wy[sś]cig|etap|edycja|stage|prova|tappa|kolo)\s*\d+.*$/i, "")
    .replace(/\b(19|20)\d\d(\s*\/\s*(19|20)?\d\d)?\b/g, "")
    .replace(/\b\d{2}\/\d{2}\b/g, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\bpowered by\b.*$/i, "")
    .replace(/[\s,(–—-]+$/g, "")
    .trim();
  return n.length >= 4 ? n : null;
}

type Race = { id: string; name: string; start_date: string; cc: string | null };
type Series = { id: string; name: string; slug: string; short_name: string | null; country_code: string | null };

export type SeriesProposal = { key: string; country: string | null; name: string; existing: Series | null; races: Race[] };

export async function proposeSeriesLinks(opts?: { countries?: string[] }): Promise<SeriesProposal[]> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const races: Race[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, location:locations(country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .is("series_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .order("id")
      .range(from, from + PAGE - 1);
    for (const r of (data ?? []) as unknown as { id: string; name: string; start_date: string; location: { country_code: string | null } | null }[]) {
      const cc = r.location?.country_code ?? null;
      if (opts?.countries?.length && (!cc || !opts.countries.includes(cc))) continue;
      races.push({ id: r.id, name: r.name, start_date: r.start_date, cc });
    }
    if (!data || data.length < PAGE) break;
  }
  const series: Series[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase.from("series").select("id, name, slug, short_name, country_code").eq("visibility", "public").range(from, from + PAGE - 1);
    series.push(...((data ?? []) as Series[]));
    if (!data || data.length < PAGE) break;
  }
  // Existing series by the folded names a race title might contain.
  const known = series
    .flatMap((s) => [s.name, s.short_name].filter((x): x is string => Boolean(x)).map((n) => ({ s, n: fold(seriesPrefix(n) ?? n) })))
    .filter((x) => x.n.length >= 6)
    .sort((a, b) => b.n.length - a.n.length);

  const groups = new Map<string, SeriesProposal>();
  for (const r of races) {
    const f = ` ${fold(r.name)} `;
    const hit = known.find((k) => f.includes(` ${k.n} `) && (!k.s.country_code || !r.cc || k.s.country_code.trim() === r.cc));
    if (hit) {
      const key = `id:${hit.s.id}`;
      const g = groups.get(key) ?? { key, country: r.cc, name: hit.s.name, existing: hit.s, races: [] };
      g.races.push(r);
      groups.set(key, g);
      continue;
    }
    const prefix = seriesPrefix(r.name);
    if (!prefix) continue;
    const key = `new:${r.cc ?? ""}:${fold(prefix)}`;
    const g = groups.get(key) ?? { key, country: r.cc, name: prefix, existing: null, races: [] };
    g.races.push(r);
    groups.set(key, g);
  }
  // A new series needs rounds: at least two races that are not one race listed
  // twice or one event's editions ("SIXDAYS Weekend Berlin 2026" and 2027),
  // and a name that is a series, not "ČP Motol" (the Czech Cup at a venue).
  const sameRace = (g: SeriesProposal) => new Set(g.races.map((r) => fold(r.name.replace(/\b(19|20)\d\d\b/g, "")))).size === 1;
  return [...groups.values()].filter(
    (g) => g.existing || (g.races.length >= 2 && !(g.races.length === 2 && sameRace(g)) && !/^(čp|cp|mčr|mcr|mistrovstv)\b/i.test(g.name)),
  );
}

const SYSTEM =
  "You check groupings of cycling races into series (cups, leagues, tours with rounds). For each numbered group you get a proposed series name and the race names. " +
  "Say ok when the races are rounds of one series of that name. Reject when the shared words are only generic (\"Ogólnopolski wyścig w kolarstwie przełajowym\", \"Mistrovství kraje\", \"MTB-Fahrtechnikkurs\", \"Gran Fondo\"), when the races are not rounds of one series, or when a race does not belong (list it). " +
  "Give the series' proper name as the organiser would write it, without a year or sponsor prefix where the core name is clear. " +
  'Answer JSON only: {"groups":[{"n":1,"ok":true,"name":"","exclude":["race name"]}]}';

export async function confirmSeriesProposals(proposals: SeriesProposal[]): Promise<{ confirmed: SeriesProposal[]; usage: LlmUsage }> {
  let usage = NO_USAGE;
  const confirmed: SeriesProposal[] = [];
  for (let i = 0; i < proposals.length; i += 25) {
    const batch = proposals.slice(i, i + 25);
    const user = batch
      .map((g, k) => `${k + 1}. proposed series: "${g.name}"${g.existing ? " (already in our catalogue)" : ""}, country ${g.country ?? "?"}\n${g.races.slice(0, 12).map((r) => `   - ${r.name} (${r.start_date})`).join("\n")}`)
      .join("\n\n");
    const { json, usage: u } = await askJson<{ groups?: { n?: number; ok?: boolean; name?: string; exclude?: string[] }[] }>({ system: SYSTEM, user, model: SONNET, maxTokens: 3000 });
    usage = { tokensIn: usage.tokensIn + u.tokensIn, tokensOut: usage.tokensOut + u.tokensOut, costUsd: usage.costUsd + u.costUsd };
    for (const v of json?.groups ?? []) {
      const g = typeof v.n === "number" ? batch[v.n - 1] : undefined;
      if (!g || v.ok !== true) continue;
      const out = new Set((v.exclude ?? []).map((x) => fold(x)));
      const races = g.races.filter((r) => !out.has(fold(r.name)));
      if (!races.length || (!g.existing && races.length < 2)) continue;
      confirmed.push({ ...g, name: g.existing ? g.existing.name : (v.name?.trim() || g.name), races });
    }
  }
  return { confirmed, usage };
}

export async function applySeriesLinks(proposals: SeriesProposal[], log?: (l: string) => void): Promise<{ linked: number; created: number }> {
  const supabase = createServerSupabase();
  let linked = 0;
  let created = 0;
  for (const g of proposals) {
    let id = g.existing?.id ?? null;
    if (!id) {
      const slug = slugifySeries(g.name);
      const { data: same } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
      if (same) id = same.id as string;
      else {
        const { data: made } = await supabase
          .from("series")
          .insert({ slug, name: g.name, name_normalized: normalizeName(g.name), country_code: g.country, source_kind: "other" })
          .select("id")
          .single();
        if (!made) continue;
        id = made.id as string;
        created += 1;
      }
    }
    const ids = g.races.map((r) => r.id);
    const { data } = await supabase.from("events").update({ series_id: id, updated_at: new Date().toISOString() }).in("id", ids).is("series_id", null).select("id");
    linked += data?.length ?? 0;
    log?.(`LINK ${g.name}${g.existing ? "" : " (new)"} ← ${g.races.map((r) => r.name).slice(0, 4).join(" | ")}${g.races.length > 4 ? ` … +${g.races.length - 4}` : ""}`);
  }
  return { linked, created };
}
