/**
 * One pass over every website we hold: the organiser's Facebook page for series and upcoming races
 * that have none, by the rules of src/lib/catalog/facebook-links.ts (the daily reader keeps it up
 * after this). Facebook itself is never read.
 *
 * Series first, the ones with the most rounds first; then races, the websites most races share
 * first. One request at a time per website. A race whose site only names its series' page gets
 * nothing of its own: the race card already shows the series' link.
 *
 *   npx tsx scripts/backfill-facebook-links.ts [--dry] [--max-pages=N] [--series-only]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { facebookPageFromHtml, organiserFacebookPage } from "../src/lib/catalog/facebook-links";
import { fetchBot } from "../src/lib/http/fetch";
import { facebookPageUrl, hostOf, isAggregatorUrl } from "../src/lib/watcher/public-url";
import { readAllRows } from "../src/lib/supabase/read-all";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const DRY = process.argv.includes("--dry");
const SERIES_ONLY = process.argv.includes("--series-only");
const MAX_PAGES = Number(process.argv.find((a) => a.startsWith("--max-pages="))?.slice(12) ?? Infinity);
const db = createServerSupabase();
const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const out = resolve("reports", `facebook-backfill-${today}`);
mkdirSync(out, { recursive: true });

type Found = { kind: "series" | "event"; slug: string; name: string; link: string; page: string };
const found: Found[] = [];
const stats = { seriesPages: 0, seriesFilled: 0, eventPages: 0, eventsFilled: 0, eventsCoveredBySeries: 0, silent: 0, failed: 0 };
const failedHosts = new Map<string, number>();

/** One page, or null; a website that keeps failing is left alone for the rest of the run. */
async function read(url: string): Promise<{ html: string; url: string } | null> {
  const host = hostOf(url) ?? url;
  if ((failedHosts.get(host) ?? 0) >= 2) return null;
  try {
    const res = await fetchBot(url, { timeoutMs: 15_000 });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) throw Error(String(res.status));
    return { html: await res.text(), url: res.url || url };
  } catch {
    failedHosts.set(host, (failedHosts.get(host) ?? 0) + 1);
    stats.failed += 1;
    return null;
  }
}

/** Run jobs grouped by website: websites side by side, a website's pages one after another. */
async function byHost<T>(jobs: { url: string; run: () => Promise<T> }[], parallel = 8) {
  const hosts = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const host = hostOf(job.url) ?? job.url;
    hosts.set(host, [...(hosts.get(host) ?? []), job]);
  }
  const queue = [...hosts.values()];
  await Promise.all(Array.from({ length: parallel }, async () => {
    for (let list = queue.shift(); list; list = queue.shift()) for (const job of list) await job.run();
  }));
}

async function fact(id: string, kind: "series" | "event", link: string, page: string) {
  if (kind !== "event") return;
  await db.from("event_facts").insert({
    event_id: id, field: "facebook_url", value: link as unknown as Json, source_url: page,
    quote: `Link on the race's website: ${link}`, method: "site_link", version: "facebook-backfill-v1",
  });
}

async function seriesPass() {
  const series = await readAllRows<{ id: string; slug: string; name: string; short_name: string | null; website_url: string }>((from, to) =>
    db.from("series").select("id,slug,name,short_name,website_url").eq("visibility", "public").not("website_url", "is", null).is("facebook_url", null).order("id").range(from, to), { throwOnError: true });
  const rounds = await readAllRows<{ series_id: string }>((from, to) =>
    db.from("event_series").select("series_id, events!inner(start_date,merged_into_id,visibility)").gte("events.start_date", since).is("events.merged_into_id", null).eq("events.visibility", "public").order("series_id").range(from, to), { throwOnError: true });
  const count = new Map<string, number>();
  for (const r of rounds) count.set(r.series_id, (count.get(r.series_id) ?? 0) + 1);
  const todo = series.filter((s) => !isAggregatorUrl(s.website_url) || facebookPageUrl(s.website_url))
    .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0)).slice(0, MAX_PAGES);
  console.log(`series to look at: ${todo.length} (biggest: ${todo.slice(0, 5).map((s) => `${s.name} ${count.get(s.id) ?? 0}`).join(", ")})`);
  await byHost(todo.map((s) => ({
    url: s.website_url,
    run: async () => {
      let link = organiserFacebookPage(s.website_url), page = s.website_url;
      if (!link) {
        const got = await read(s.website_url);
        stats.seriesPages += 1;
        if (!got) return;
        link = facebookPageFromHtml(got.html, got.url, [s.name, ...(s.short_name ? [s.short_name] : [])]);
        page = got.url;
      }
      if (!link) { stats.silent += 1; return; }
      found.push({ kind: "series", slug: s.slug, name: s.name, link, page });
      stats.seriesFilled += 1;
      console.log(`SERIES ${s.name} (${count.get(s.id) ?? 0}) → ${link}`);
      if (!DRY) await db.from("series").update({ facebook_url: link, updated_at: new Date().toISOString() }).eq("id", s.id).is("facebook_url", null);
    },
  })));
}

async function eventPass() {
  type Row = { id: string; slug: string; name: string; website_url: string; series_id: string | null; series: { name: string; facebook_url: string | null } | null };
  const events = await readAllRows<Row>((from, to) =>
    db.from("events").select("id,slug,name,website_url,series_id,series:series!events_series_id_fkey(name,facebook_url)")
      .eq("visibility", "public").is("merged_into_id", null).gte("start_date", since).not("website_url", "is", null).is("facebook_url", null)
      .order("id").range(from, to), { throwOnError: true });
  const pages = new Map<string, Row[]>();
  for (const e of events) {
    if (isAggregatorUrl(e.website_url) && !facebookPageUrl(e.website_url)) continue;
    pages.set(e.website_url, [...(pages.get(e.website_url) ?? []), e]);
  }
  // Websites most races share first: one read fills a whole series' rounds.
  const hostSize = new Map<string, number>();
  for (const [url, list] of pages) hostSize.set(hostOf(url) ?? url, (hostSize.get(hostOf(url) ?? url) ?? 0) + list.length);
  const todo = [...pages.entries()].sort((a, b) => (hostSize.get(hostOf(b[0]) ?? b[0]) ?? 0) - (hostSize.get(hostOf(a[0]) ?? a[0]) ?? 0)).slice(0, MAX_PAGES);
  console.log(`race websites to read: ${todo.length} for ${todo.reduce((n, [, l]) => n + l.length, 0)} races`);
  let done = 0;
  await byHost(todo.map(([url, list]) => ({
    url,
    run: async () => {
      let html: { html: string; url: string } | null = null;
      const direct = organiserFacebookPage(url);
      if (!direct) { html = await read(url); stats.eventPages += 1; if (!html) return; }
      for (const e of list) {
        const link = direct ?? facebookPageFromHtml(html!.html, html!.url, [e.name, ...(e.series?.name ? [e.series.name] : [])]);
        if (!link) { stats.silent += 1; continue; }
        if (link === e.series?.facebook_url) { stats.eventsCoveredBySeries += 1; continue; }
        found.push({ kind: "event", slug: e.slug, name: e.name, link, page: html?.url ?? url });
        stats.eventsFilled += 1;
        if (!DRY) {
          const { data } = await db.from("events").update({ facebook_url: link, updated_at: new Date().toISOString() }).eq("id", e.id).is("facebook_url", null).select("id");
          if (data?.length) await fact(e.id, "event", link, html?.url ?? url);
        }
      }
      if (++done % 100 === 0) console.log(`  … ${done}/${todo.length} websites, ${stats.eventsFilled} races filled`);
    },
  })));
}

async function main() {
  await seriesPass();
  // Rounds of a series filled just now show its link already; read their own sites with that known.
  if (!SERIES_ONLY) await eventPass();
  writeFileSync(resolve(out, DRY ? "dry-run.json" : "applied.json"), JSON.stringify({ at: new Date().toISOString(), dry: DRY, stats, found }, null, 1));
  console.log(`\n${DRY ? "DRY " : ""}${JSON.stringify(stats)}\nlist: ${resolve(out, DRY ? "dry-run.json" : "applied.json")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
