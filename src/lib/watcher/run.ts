import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  fingerprintVariants,
  normalizeName,
  slugifyEvent,
  type ParsedEvent,
} from "@/lib/domain";
import {
  extractEvents,
  fetchPage,
  nextPollAt,
  errorPollAt,
  reviewPollAt,
  sourcePollAt,
  nextSeasonUrl,
  isPendingSeasonUrl,
} from "@/lib/watcher/core";
import { hostnameOf, mapPool } from "@/lib/watcher/pool";
import { looksLikeIndependentRaceUrl, queueDiscoveredLink } from "@/lib/watcher/explore";

export type WatchOutcome = {
  watchedUrlId: string;
  url: string;
  ok: boolean;
  unchanged?: boolean;
  eventsUpserted: number;
  linksDiscovered: number;
  droppedHidden?: number;
  strategy?: string;
  error?: string;
  httpStatus?: number;
  preview?: ParsedEvent[];
};

const MAX_NEW_PER_RUN = 200;
const MAX_NEW_PER_RUN_FCI = 400;
const MAX_NEW_PER_RUN_RR = 400;
const MAX_REFRESH_PER_RUN = 250;
/** Soft claim window so overlapping crons don't double-process the same row. */
const CLAIM_MS = 20 * 60 * 1000;
/** Stay under Fluid Compute's 300s cap with room for geocode. */
const DEFAULT_BUDGET_MS = 200_000;
const DEFAULT_CONCURRENCY = 5;
const CALENDAR_KINDS = ["series", "federation", "aggregator", "calendar"] as const;

export async function runDueWatches(
  limit = 120,
  opts?: { concurrency?: number; budgetMs?: number },
): Promise<WatchOutcome[]> {
  const supabase = createServerSupabase();
  const nowIso = new Date().toISOString();
  const claimUntil = new Date(Date.now() + CLAIM_MS).toISOString();

  async function claimDue(kinds: readonly string[], take: number) {
    if (take <= 0) return [];
    const { data: due, error } = await supabase
      .from("watched_urls")
      .select("*")
      .eq("status", "active")
      .in("kind", [...kinds])
      .lte("next_poll_at", nowIso)
      .order("next_poll_at", { ascending: true })
      .limit(Math.max(take * 3, 40));
    if (error) throw new Error(error.message);
    const dumpHost = /federciclismo\.it|eventivsport\.com|ffc\.fr|ffvelo\.fr/i;
    const rest = (due ?? []).filter((row) => !dumpHost.test(row.url as string));
    const dumps = (due ?? []).filter((row) => dumpHost.test(row.url as string)).slice(0, 2);
    const ranked = [...rest, ...dumps].slice(0, take);
    const claimed: NonNullable<typeof due> = [];
    for (const row of ranked) {
      const { data: won } = await supabase
        .from("watched_urls")
        .update({
          next_poll_at: claimUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "active")
        .lte("next_poll_at", nowIso)
        .select("id")
        .maybeSingle();
      if (won?.id) claimed.push(row);
    }
    return claimed;
  }

  // Calendars first — one series page is worth dozens of race pages.
  const calendars = await claimDue(CALENDAR_KINDS, limit);
  const claimed = [
    ...calendars,
    ...(await claimDue(["race"], limit - calendars.length)),
  ];

  const deadline = Date.now() + (opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
  const outcomes = await mapPool(claimed, concurrency, async (row) => {
    if (Date.now() > deadline) {
      // Release claim so another run can pick it up soon
      await supabase
        .from("watched_urls")
        .update({ next_poll_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "time budget exceeded",
      } satisfies WatchOutcome;
    }
    return watchOne(row);
  });

  return outcomes;
}

export async function watchOne(row: {
  id: string;
  url: string;
  etag?: string | null;
  last_modified?: string | null;
  content_hash?: string | null;
  kind?: string;
  last_extract_status?: string | null;
}): Promise<WatchOutcome> {
  const supabase = createServerSupabase();
  const runInsert = await supabase
    .from("ingest_runs")
    .insert({ watched_url_id: row.id })
    .select("id")
    .single();

  try {
    const fetched = await fetchPage(row.url, {
      etag: row.etag,
      lastModified: row.last_modified,
      contentHash: row.content_hash,
    });

    if (fetched.status === 404) {
      // Next-year calendars (`/zavody-2027/`) 404 until published — keep watching.
      if (isPendingSeasonUrl(row.url)) {
        await supabase
          .from("watched_urls")
          .update({
            status: "active",
            http_status: 404,
            last_fetched_at: new Date().toISOString(),
            last_error: null,
            last_extract_status: "off_season",
            next_poll_at: sourcePollAt([]).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await finishRun(runInsert.data?.id, {
          ok: true,
          error: "404 pending season",
          httpStatus: 404,
        });
        return {
          watchedUrlId: row.id,
          url: row.url,
          ok: true,
          eventsUpserted: 0,
          linksDiscovered: 0,
          strategy: "off_season",
          error: "404 pending season",
          httpStatus: 404,
        };
      }
      await supabase
        .from("watched_urls")
        .update({
          status: "dead",
          http_status: 404,
          last_fetched_at: new Date().toISOString(),
          last_error: "HTTP 404",
          last_extract_status: "dead",
          next_poll_at: nextPollAt().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await finishRun(runInsert.data?.id, {
        ok: false,
        error: "404",
        httpStatus: 404,
      });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "404",
        httpStatus: 404,
      };
    }

    if (fetched.unchanged || fetched.status === 304) {
      await supabase
        .from("watched_urls")
        .update({
          last_fetched_at: new Date().toISOString(),
          http_status: fetched.status,
          next_poll_at: nextPollAt().toISOString(),
          last_extract_status: "unchanged",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      const { touchLastSeenForWatchedUrl } = await import("@/lib/catalog/freshness");
      await touchLastSeenForWatchedUrl(row.id);
      await finishRun(runInsert.data?.id, { ok: true, httpStatus: fetched.status });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: true,
        unchanged: true,
        eventsUpserted: 0,
        linksDiscovered: 0,
        httpStatus: fetched.status,
      };
    }

    if (fetched.status >= 400) {
      throw new Error(`HTTP ${fetched.status}`);
    }

    const extracted = await extractEvents(row.url, fetched.html);
    const { data: knownRows } = await supabase
      .from("event_sources")
      .select("external_id")
      .eq("watched_url_id", row.id)
      .not("external_id", "is", null);
    const known = new Set(
      (knownRows ?? []).map((r) => r.external_id).filter((id): id is string => Boolean(id)),
    );

    const candidates = extracted.events.filter((ev) => ev.confidence >= 0.35);
    const maxNew =
      extracted.strategy?.includes("fci") || row.url.includes("federciclismo")
        ? MAX_NEW_PER_RUN_FCI
        : extracted.strategy?.includes("raceresult") || /raceresult\.com\/events/.test(row.url)
          ? MAX_NEW_PER_RUN_RR
          : MAX_NEW_PER_RUN;
    const fresh = candidates
      .filter((ev) => !ev.externalId || !known.has(ev.externalId))
      .slice(0, maxNew);
    // When page changed, refresh a sample of known races so updates land
    const refresh = candidates
      .filter((ev) => ev.externalId && known.has(ev.externalId))
      .slice(0, MAX_REFRESH_PER_RUN);
    const toUpsert = dedupeByExternalId([...fresh, ...refresh]);

    let upserted = 0;
    // Bounded parallelism for DB upserts (same-host sources stay polite upstream)
    const upsertResults = await mapPool(toUpsert, 4, async (ev) =>
      upsertParsedEvent(ev, row.id, row.kind),
    );
    upserted = upsertResults.filter(Boolean).length;

    let linksDiscovered = 0;
    for (const child of extracted.childUrls) {
      try {
        if (/\.pdf($|\?)/i.test(child)) continue;
        if (
          /mtbkalender\.dk|kidsmtbcup\.dk|dgi\.dk|kenniscentrum\.knwu\.nl|mijn\.knwu\.nl|velo\.ffc\.fr|competitions\.ffc\.fr|rfec\.com|orobiecup\.it|mtbsport\.it|jiskra\.potocky\.cz|potocky\.cz/i.test(
            child,
          )
        ) {
          continue;
        }
        const sameHost = hostnameOf(child) === hostnameOf(row.url);
        if (
          sameHost &&
          (row.kind === "series" ||
            row.kind === "federation" ||
            row.kind === "aggregator" ||
            row.kind === "calendar")
        ) {
          // FCI /race/detail and ical feeds are covered by the list crawl — don't enqueue them
          if (
            hostnameOf(child).includes("federciclismo.it") &&
            (/\/race\/detail\//i.test(child) || /\/race\/icald\//i.test(child))
          ) {
            continue;
          }
          if (
            hostnameOf(child).includes("federciclismo.it") &&
            !hostnameOf(child).includes("members.")
          ) {
            if (
              !/circuiti-mtb\/italia-bike-cup/i.test(child) &&
              !/circuiti-mtb\/coppa-italia-giovanile\/?(\?|$)/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("ciclisme.cat")) {
            if (!/campionat\/btt\/copa-catalana-internacional-btt|campionat\/btt\/copa-catalunya-btt/i.test(child)) {
              continue;
            }
          }
          if (hostnameOf(child).includes("esmtb.com")) {
            if (!/calendario-de-las-copas-de-espana/i.test(child)) continue;
          }
          // Racement calendars already have every round — skip detail/hub noise
          if (
            hostnameOf(child).includes("kidscup.bike") ||
            hostnameOf(child).includes("rookiescup.bike") ||
            hostnameOf(child).includes("ixsdownhillcup.com")
          ) {
            const path = (() => {
              try {
                return new URL(child).pathname;
              } catch {
                return child;
              }
            })();
            if (!/\/(en\/)?race-calendar|\/rennkalender\/?$/i.test(path)) {
              continue;
            }
          }
          // Prima / ČP / ZAL / Enduro / Praha listings — don't enqueue every CMS page
          if (hostnameOf(child).includes("iprimacup.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/zavody-20\d{2}/i.test(path) && path.replace(/\/$/, "") !== "") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("poharmtb.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/cross-country|enduro|downhill/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("zapadoceskaamaterskaliga.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/kalendare\//i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("enduroserie.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/zavody") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("jihoceskymtbpohar.cz")) {
            try {
              const path = new URL(child).pathname;
              if (path.startsWith("/race/")) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ucimtbworldseries.com")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/calendar\/?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("swiss-cycling.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/kalender\/?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("swissbikecup.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|de|fr)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtb-cup.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/^\/(en\/)?race$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("valais-cycling.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-bike-cup-valais/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("eigerbike.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-race/i.test(path) && !/\/race\/informations/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bikekingdom.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/kids-cup/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bikeclub-engelberg.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/valiant-gp/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("brvinfo.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/bundicycling-kidscup") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mso.swiss")) continue;
          if (hostnameOf(child).includes("bratislavskymtbmaraton.biker.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/\/preteky\/(maraton|detske-preteky|kids-zone|bikefest-marathon)/i.test(path)) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("detskatour.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/\/category\/propozicie/i.test(path)) {
                if (!(/\/20\d{2}\//.test(path) && /kolo|propoz|dtps|dpts/i.test(path))) {
                  continue;
                }
              }
              if (/ohodno|fotogal|feed|wp-content/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("detskymtbcup.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("skvelopraha.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/velky-haj") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("pekloseveru.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (
                !/\/(registrace|registration)$/i.test(path) &&
                !/\/(propozice-serialu|series-regulations)$/i.test(path)
              ) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ustimtbcup.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("ppkbike.cz") ||
            hostnameOf(child).includes("ppk-hk.cz")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/index.html" && path !== "/ppk-races.js") {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("cyclingaustria.at")) {
            try {
              const u = new URL(child);
              if (!/kalender/i.test(u.pathname)) continue;
              if (/[?&]kalender\?/i.test(u.search)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rad-net.de")) {
            if (!/ga-bl-cyclo-cross/i.test(child)) continue;
          }
          // CUBE Cup homepage lists all races — skip news/detail/anmeldung noise
          if (hostnameOf(child).includes("cup.cube.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          // TBC: only series root + season calendars (not individual /zavod- pages)
          if (hostnameOf(child).includes("tbcserie.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/^\/?$/.test(path) && !/\/kalendar-?20\d{2}/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("cyklistikaszc.sk")) {
            try {
              const path = new URL(child).pathname;
              if (
                !/\/(mtb-cross-country|cestna-cyklistika|cyklokros|bmx-racing|bmx-freestyle|mtb-downhill-fourcross|cyklotrial|drahova-cyklistika)\/kalendar\/?$/i.test(
                  path,
                )
              ) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("albgold-juniorscup.de") ||
            hostnameOf(child).includes("xco-bikecup.de") ||
            hostnameOf(child).includes("schwarzwaelder-mtb-cup.de") ||
            hostnameOf(child).includes("rhein-eifel-mtb-cup.de") ||
            hostnameOf(child).includes("mtb-oberschwaben-cup.de") ||
            hostnameOf(child).includes("salzkammergut-trophy.at")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("jcp-mtb.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bayerwald-mtb-cup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("skiclub-bb.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/werdenfelscup.html") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sportchallenge.cz")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/\/podkrkonosskymaraton\/2026$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("mtb-rhein-main-cup.de") ||
            hostnameOf(child).includes("mpdv-cup.de") ||
            hostnameOf(child).includes("mountainbike-challenge.at") ||
            hostnameOf(child).includes("globmetalxc.pl")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtb-kidscup.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/start/termine-2") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("soof.sk")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/podujatia-a-akcie") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("schulsportverein.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/stadtmeisterschaft") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sport-base.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/competitions") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("raceresult.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/\/(387659|377510)(\/info)?$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("datasport.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (!/mtbwildpoldsried2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rookiescup-ostbayern.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/rennen") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbsaarlandliga.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/rennen") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("juniorbikecup.at")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "");
              if (path !== "/termine") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("on-offteam.cz")) {
            try {
              const path = new URL(child).pathname;
              if (!/on-off-mtb-pohar/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("polandbike.pl")) {
            try {
              const path = new URL(child).pathname;
              if (!/kalendarz/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("xco-nrw-cup.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("schwarzwald-bike-marathon.de")) {
            try {
              const path = new URL(child).pathname;
              if (!/rena-kids-cup/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("albstadt-bike-marathon.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("rsv-bad-griesbach.de")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bahno.ambike.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/propozice-2026-jaro/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bike-revolution.ch")) {
            if (!/anmeldung-2026/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("bikeside.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/kategorien") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbraceseries.ch")) {
            try {
              const path = new URL(child).pathname;
              if (!/\/egg/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("fmciclismo.com")) {
            if (!/ESCUELAS/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("marathon-man.eu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("authorkralsumavy.cz") ||
            hostnameOf(child).includes("malevilcup.cz") ||
            hostnameOf(child).includes("horal.sk") ||
            hostnameOf(child).includes("grand-raid-bcvs.ch") ||
            hostnameOf(child).includes("raidevolenard-fmv.ch") ||
            hostnameOf(child).includes("mtbpomerania.pl") ||
            hostnameOf(child).includes("silesia.bike") ||
            hostnameOf(child).includes("troitrek.it") ||
            hostnameOf(child).includes("mb-race.com") ||
            hostnameOf(child).includes("transmaurienne-vanoise.com") ||
            hostnameOf(child).includes("ryebikefestival.no") ||
            hostnameOf(child).includes("alpen-tour.at") ||
            hostnameOf(child).includes("riojabikeexperience.com")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("bike-marathon.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(de|en)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("herodolomites.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|it|de|fr)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sloenduro.com")) {
            if (!/sloenduro-calendar/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("sloxcup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/dirke-2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("sloveniadownhillcup.si")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/((en|sl)\/)?(races|dirke)-2026/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("belgiancycling.be")) {
            if (!/3-nations-cup\/kalender/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("cycling.vlaanderen")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/\/competitie\/mtb\/(xco|kids)-series$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("mtbcompetitieoostnederland.nl")) {
            if (!/agenda-mbt-cup/i.test(child)) continue;
          }
          if (hostnameOf(child).includes("knwu.nl") || hostnameOf(child).includes("kenniscentrum.knwu.nl")) {
            if (
              !/kampioenschappen\/nk-mountainbike/i.test(child) &&
              !/streetrace-competitie-2026/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("rocazur.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(fr|en)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("crosskovacsi.hu")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && path !== "/hu/nyitolap") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("hbs.hr")) {
            if (
              !/\/kalendar\/mtb/i.test(child) &&
              !/\/kalendar\/?(\?|$)/i.test(child) &&
              !/\/kalendar\/page\/\d+/i.test(child)
            ) {
              continue;
            }
          }
          if (hostnameOf(child).includes("superprestigecyclocross.be")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(nl|en|fr)?\/?kalender$/i.test(path) && path !== "/") continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("ucicyclocrossworldcup.com")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|nl|fr)?\/?calendar$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("uec.ch")) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (!/^\/(en|fr|de)\/calendar$/i.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (
            hostnameOf(child).includes("letour.fr") ||
            hostnameOf(child).includes("paris-roubaix.fr") ||
            hostnameOf(child).includes("oesterreich-rundfahrt.at") ||
            hostnameOf(child).includes("tourofaustria.com") ||
            hostnameOf(child).includes("tourdesuisse.ch") ||
            hostnameOf(child).includes("gravelchallenge.dk") ||
            hostnameOf(child).includes("quebrantahuesos.com") ||
            hostnameOf(child).includes("lapuritoandorra.com") ||
            hostnameOf(child).includes("kotl.at") ||
            hostnameOf(child).includes("faustocoppi.net") ||
            hostnameOf(child).includes("haervejsloebet.dk")
          ) {
            try {
              const path = new URL(child).pathname.replace(/\/$/, "") || "/";
              if (path !== "/" && !/^\/(en|fr|de|es|it)?$/.test(path)) continue;
            } catch {
              continue;
            }
          }
          if (hostnameOf(child).includes("pyoraily.fi")) {
            if (!/kultainen-kampi/i.test(child)) continue;
          }
          const { error } = await supabase.from("watched_urls").upsert(
            {
              url: child,
              kind: "series",
              parent_id: row.id,
              status: "active",
              added_by: "auto-same-domain",
              notes: "Calendar follow-up from adapter",
              next_poll_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "url", ignoreDuplicates: true },
          );
          if (!error) linksDiscovered += 1;
        } else if (
          linksDiscovered < 24 &&
          (looksLikeIndependentRaceUrl(child) || row.kind === "aggregator")
        ) {
          const queued = await queueDiscoveredLink(child, {
            hintKind: "outbound",
            fromWatchedUrlId: row.id,
            force: row.kind === "aggregator",
          });
          if (queued) linksDiscovered += 1;
        }
      } catch {
        /* ignore bad child URLs */
      }
    }

    const successor = nextSeasonUrl(row.url);
    if (
      successor &&
      (row.kind === "series" ||
        row.kind === "federation" ||
        row.kind === "aggregator" ||
        row.kind === "calendar")
    ) {
      const { data: existingSeason } = await supabase
        .from("watched_urls")
        .select("id, status")
        .eq("url", successor)
        .maybeSingle();
      if (!existingSeason) {
        const { error } = await supabase.from("watched_urls").insert({
          url: successor,
          kind: row.kind,
          parent_id: row.id,
          status: "active",
          added_by: "season-successor",
          notes: "Next season URL derived from year-stamped calendar",
          next_poll_at: sourcePollAt([]).toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (!error) linksDiscovered += 1;
      } else if (existingSeason.status === "dead") {
        await supabase
          .from("watched_urls")
          .update({
            status: "active",
            last_extract_status: "off_season",
            last_error: null,
            next_poll_at: sourcePollAt([]).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSeason.id);
      }
    }

    const calendarKind =
      row.kind === "series" ||
      row.kind === "federation" ||
      row.kind === "aggregator" ||
      row.kind === "calendar";
    const offSeasonEmpty = calendarKind && extracted.events.length === 0;
    const needsReview =
      !offSeasonEmpty && (extracted.events.length === 0 || extracted.confidence < 0.4);

    let droppedHidden = 0;
    if (calendarKind && !needsReview && !offSeasonEmpty) {
      const { hideDroppedCalendarEvents } = await import("@/lib/catalog/freshness");
      const extractedIds = new Set(
        candidates
          .map((ev) => ev.externalId)
          .filter((id): id is string => Boolean(id)),
      );
      droppedHidden = await hideDroppedCalendarEvents({
        watchedUrlId: row.id,
        extractedExternalIds: extractedIds,
        extractedCount: candidates.length,
      });
    }

    await supabase
      .from("watched_urls")
      .update({
        content_hash: fetched.hash,
        etag: fetched.etag,
        last_modified: fetched.lastModified,
        http_status: fetched.status,
        last_fetched_at: new Date().toISOString(),
        last_changed_at: new Date().toISOString(),
        last_error: needsReview ? "low confidence or empty extract" : null,
        last_extract_status: offSeasonEmpty
          ? "off_season"
          : needsReview
            ? "needs_review"
            : "ok",
        // Stay active — retry later instead of permanent pause
        status: "active",
        next_poll_at: needsReview
          ? reviewPollAt().toISOString()
          : extracted.strategy?.includes("fci")
            ? // Rotate month windows every ~2h until season is filled
              new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            : sourcePollAt(extracted.events).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (extracted.strategy.startsWith("adapter") || extracted.strategy === "jsonld") {
      await bumpExtractionProfile(
        hostnameOf(row.url),
        extracted.strategy,
      );
    }

    await finishRun(runInsert.data?.id, {
      ok: true,
      eventsUpserted: upserted,
      linksDiscovered,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
    });

    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: true,
      eventsUpserted: upserted,
      linksDiscovered,
      droppedHidden,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
      preview: extracted.events.slice(0, 5),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    const priorFail = row.last_extract_status === "error" ? 2 : 1;
    await supabase
      .from("watched_urls")
      .update({
        last_error: message,
        last_extract_status: "error",
        last_fetched_at: new Date().toISOString(),
        next_poll_at: errorPollAt(priorFail).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    await finishRun(runInsert.data?.id, { ok: false, error: message });
    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: false,
      eventsUpserted: 0,
      linksDiscovered: 0,
      error: message,
    };
  }
}

function dedupeByExternalId(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  const out: ParsedEvent[] = [];
  for (const ev of events) {
    const key = ev.externalId || `${ev.startDate}:${normalizeName(ev.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

async function bumpExtractionProfile(host: string, strategy: string) {
  const supabase = createServerSupabase();
  const { data: existing } = await supabase
    .from("extraction_profiles")
    .select("id, success_count")
    .eq("host", host)
    .eq("strategy", strategy)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("extraction_profiles")
      .update({
        success_count: (existing.success_count ?? 0) + 1,
        last_success_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("extraction_profiles").insert({
      host,
      strategy,
      recipe: { source: strategy },
      success_count: 1,
      last_success_at: new Date().toISOString(),
    });
  }
}

async function finishRun(
  id: string | undefined,
  opts: {
    ok: boolean;
    error?: string;
    eventsUpserted?: number;
    linksDiscovered?: number;
    strategy?: string;
    httpStatus?: number;
  },
) {
  if (!id) return;
  const supabase = createServerSupabase();
  await supabase
    .from("ingest_runs")
    .update({
      finished_at: new Date().toISOString(),
      ok: opts.ok,
      error: opts.error ?? null,
      events_upserted: opts.eventsUpserted ?? 0,
      links_discovered: opts.linksDiscovered ?? 0,
      strategy: opts.strategy ?? null,
      http_status: opts.httpStatus ?? null,
    })
    .eq("id", id);
}

function slugifySeries(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function unionText(a: string[] | null | undefined, b: string[] | null | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])].filter(Boolean))];
}

const SERIES_LEVEL_RANK: Record<string, number> = {
  local: 0,
  regional: 1,
  national: 2,
  continental: 3,
  international: 4,
  world_cup: 5,
  european_championship: 6,
  world_championship: 7,
};

async function resolveSeriesId(
  supabase: ReturnType<typeof createServerSupabase>,
  ev: ParsedEvent,
  classified: {
    disciplines: string[];
    ageCategories: string[];
    level: string;
    competitionType: string;
    season: string;
  },
  websiteFn: (url?: string | null, fallback?: string | null) => string | null,
): Promise<string | undefined> {
  if (!ev.seriesName && !ev.seriesSlug) return undefined;

  const { inferSeriesType, inferSeriesSourceKind, audienceFromAgeCategories } =
    await import("@/lib/taxonomy");
  type AgeCategory = import("@/lib/taxonomy").AgeCategory;

  const slug = ev.seriesSlug || slugifySeries(ev.seriesName || "series");
  const name = ev.seriesName || slug;
  const website = websiteFn(ev.seriesWebsite);
  const country =
    ev.countryHint && ev.countryHint.length === 2 ? ev.countryHint.toUpperCase() : null;
  const seriesType = inferSeriesType({
    name,
    slug,
    disciplines: classified.disciplines,
    ageCategories: classified.ageCategories,
  });
  const sourceKind = inferSeriesSourceKind({
    name,
    slug,
    url: website || ev.seriesWebsite || ev.sourceUrl,
  });
  const now = new Date().toISOString();

  const { data: existing } = await supabase.from("series").select("*").eq("slug", slug).maybeSingle();

  if (existing) {
    const disciplines = unionText(existing.disciplines as string[], classified.disciplines);
    const ageCategories = unionText(existing.age_categories as string[], classified.ageCategories);
    const existingLevel = String(existing.level ?? "local");
    const level =
      (SERIES_LEVEL_RANK[classified.level] ?? 0) > (SERIES_LEVEL_RANK[existingLevel] ?? 0)
        ? classified.level
        : existingLevel;
    const competitionType =
      existing.competition_type && existing.competition_type !== "other"
        ? String(existing.competition_type)
        : classified.competitionType;
    const patch: Record<string, unknown> = {
      last_seen_at: now,
      updated_at: now,
      name_normalized: existing.name_normalized || normalizeName(name),
      disciplines,
      age_categories: ageCategories,
      level,
      competition_type: competitionType,
    };
    if (ageCategories.length) {
      patch.audience_hint = audienceFromAgeCategories(ageCategories as AgeCategory[]);
    }
    if (website && !existing.website_url) patch.website_url = website;
    if (country && !existing.country_code) patch.country_code = country;
    if (classified.season && !existing.season) patch.season = classified.season;
    if (!existing.series_type || existing.series_type === "other") patch.series_type = seriesType;
    if (!existing.source_url && (website || ev.sourceUrl)) {
      patch.source_url = website || ev.sourceUrl;
    }
    if (!existing.source_kind || existing.source_kind === "other") patch.source_kind = sourceKind;
    await supabase.from("series").update(patch).eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("series")
    .insert({
      slug,
      name,
      name_normalized: normalizeName(name),
      website_url: website,
      audience_hint: classified.ageCategories.length
        ? audienceFromAgeCategories(classified.ageCategories as AgeCategory[])
        : ev.audience || "mixed",
      country_code: country,
      disciplines: classified.disciplines,
      age_categories: classified.ageCategories,
      series_type: seriesType,
      level: classified.level,
      competition_type: classified.competitionType,
      season: classified.season || null,
      source_url: website || ev.sourceUrl || null,
      source_kind: sourceKind,
      last_seen_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (created?.id) return created.id as string;
  // Parallel upserts of the same series race on unique(slug).
  if (error) {
    const { data: raced } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
    if (raced?.id) return raced.id as string;
  }
  return undefined;
}

async function upsertParsedEvent(
  ev: ParsedEvent,
  watchedUrlId: string,
  watchedKind?: string,
) {
  const { isIngestibleDate, inferClassification, audienceFromAgeCategories } = await import(
    "@/lib/taxonomy"
  );
  if (!isIngestibleDate(ev.startDate)) return null;

  // A bracketed IOC code in the title names the *venue's* country; a calendar's
  // own hint often names the organiser's. Prefer the title — that mismatch is
  // how a Czech downhill round ended up pinned in Thuringia. Do this before the
  // classifier runs, so the country also disambiguates SP / národný vs světový.
  const { countryCodeFromName } = await import("@/lib/geo/europe");
  const titleCountry = countryCodeFromName(ev.name);
  if (titleCountry && titleCountry !== ev.countryHint) {
    ev = { ...ev, countryHint: titleCountry };
  }

  const supabase = createServerSupabase();
  const fp = fingerprint({
    startDate: ev.startDate,
    name: ev.name,
    lat: ev.lat,
    lng: ev.lng,
  });
  const { pickBestDuplicate, preferEventName, mergeDateSpan, preferLevel, normalizeUrlForDedup } =
    await import("@/lib/dedup");
  const { publicRaceUrl, preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
  const classified = inferClassification({
    name: ev.name,
    placeText: ev.placeText,
    seriesName: ev.seriesName,
    seriesSlug: ev.seriesSlug,
    disciplines: ev.discipline,
    categoryNames: (ev.categories ?? []).map((c) => c.name),
    existingAudience: ev.audience,
    startDate: ev.startDate,
    countryHint: ev.countryHint,
  });
  const levelInfo = {
    level: classified.level,
    classLabel: classified.classLabel,
    uciClass: classified.uciClass,
  };
  const disciplines = classified.disciplines.length
    ? classified.disciplines
    : ev.discipline ?? [];
  const audience = classified.ageCategories.length
    ? classified.audience
    : ev.audience ?? "mixed";

  const incomingWebsite = publicRaceUrl(ev.websiteUrl, ev.sourceUrl);
  const incomingRegistration = publicRaceUrl(ev.registrationUrl);
  const { preferRegulationsUrl, isRegulationsUrl } = await import("@/lib/watcher/regulations-url");
  const { isStartListUrl } = await import("@/lib/watcher/registration-url");
  const incomingRegulations =
    publicRaceUrl(ev.regulationsUrl) ||
    (ev.regulationsUrl && isRegulationsUrl(ev.regulationsUrl)
      ? ev.regulationsUrl.trim()
      : null) ||
    (incomingWebsite && isRegulationsUrl(incomingWebsite) ? incomingWebsite : null);
  const incomingResults = publicRaceUrl(ev.resultsUrl) || ev.resultsUrl?.trim() || null;
  const incomingUrls = [incomingWebsite, incomingRegistration, ev.sourceUrl].filter(Boolean);

  const incomingDedup = {
    startDate: ev.startDate,
    endDate: ev.endDate ?? ev.startDate,
    name: ev.name,
    lat: ev.lat,
    lng: ev.lng,
    placeText: ev.placeText,
    seriesName: ev.seriesName,
    fingerprint: fp,
    urls: incomingUrls,
  };

  type LocRow = { lat?: number; lng?: number; name?: string; municipality?: string } | null;
  type CandidateRow = {
    id: string;
    name: string;
    start_date: string;
    end_date?: string | null;
    fingerprint?: string | null;
    website_url?: string | null;
    registration_url?: string | null;
    location?: LocRow;
    series?: { name?: string } | { name?: string }[] | null;
    sources?: { source_url?: string }[] | null;
  };
  const asCandidate = (row: CandidateRow, extraUrls: (string | null | undefined)[] = []) => {
    const loc = (Array.isArray(row.location) ? row.location[0] : row.location) as LocRow;
    const series = Array.isArray(row.series) ? row.series[0] : row.series;
    return {
      row,
      event: {
        startDate: row.start_date,
        endDate: row.end_date,
        name: row.name,
        lat: loc?.lat,
        lng: loc?.lng,
        placeText: loc?.municipality || loc?.name,
        seriesName: series?.name,
        fingerprint: row.fingerprint ?? undefined,
        urls: [
          row.website_url,
          row.registration_url,
          ...(row.sources ?? []).map((x) => x.source_url),
          ...extraUrls,
        ],
      },
    };
  };

  // 1) fingerprint — exact cell first, then the neighbouring geohash cells and the
  // "nogps" variant, which only count once the scorer confirms them.
  let existingId: string | undefined;
  const fpCols =
    "id, name, start_date, end_date, fingerprint, status, visibility, website_url, registration_url, location:locations(lat, lng, name, municipality), overrides:event_overrides(locked_fields)";
  const { data: fpRows } = await supabase
    .from("events")
    .select(fpCols)
    .in("fingerprint", fingerprintVariants(ev))
    .limit(20);
  const fpCandidates = (fpRows ?? []) as unknown as (CandidateRow & { status?: string })[];
  // The exact fingerprint still wins outright, cancelled rows included — that is
  // how a cancelled race gets updated rather than resurrected as a new row.
  let byFp = fpCandidates.find((r) => r.fingerprint === fp) ?? null;
  if (!byFp) {
    const best = pickBestDuplicate(
      incomingDedup,
      fpCandidates.filter((r) => r.status !== "cancelled").map((r) => asCandidate(r)),
    );
    byFp = (best?.row as CandidateRow | undefined) ?? null;
  }
  existingId = byFp?.id;

  // 1b) same specific website / race-detail URL (strong signal)
  if (!existingId) {
    const urlCols =
      "id, name, start_date, end_date, website_url, registration_url, location:locations(lat, lng, name, municipality)";
    const exactUrls = [incomingWebsite, incomingRegistration].filter(
      (u): u is string => Boolean(u && normalizeUrlForDedup(u)),
    );
    const urlCandidates: CandidateRow[] = [];
    for (const url of exactUrls) {
      const { data: bySite } = await supabase
        .from("events")
        .select(urlCols)
        .eq("website_url", url)
        .limit(8);
      const { data: byReg } = await supabase
        .from("events")
        .select(urlCols)
        .eq("registration_url", url)
        .limit(8);
      urlCandidates.push(...((bySite ?? []) as unknown as CandidateRow[]));
      urlCandidates.push(...((byReg ?? []) as unknown as CandidateRow[]));
    }
    const bestByUrl = pickBestDuplicate(
      incomingDedup,
      urlCandidates.map((r) => asCandidate(r)),
    );
    existingId = bestByUrl?.row.id;

    if (!existingId && ev.sourceUrl && normalizeUrlForDedup(ev.sourceUrl)) {
      const { data: bySrc } = await supabase
        .from("event_sources")
        .select(
          "event_id, source_url, event:events(id, name, start_date, end_date, website_url, registration_url, location:locations(lat, lng, name, municipality))",
        )
        .eq("source_url", ev.sourceUrl)
        .limit(5);
      const srcCandidates: { row: CandidateRow; event: ReturnType<typeof asCandidate>["event"] }[] =
        [];
      for (const row of bySrc ?? []) {
        const rawEvent = row.event as unknown;
        const evRow = (Array.isArray(rawEvent) ? rawEvent[0] : rawEvent) as CandidateRow | null;
        if (!evRow?.id) continue;
        srcCandidates.push(asCandidate(evRow, [row.source_url]));
      }
      existingId = pickBestDuplicate(incomingDedup, srcCandidates)?.row.id;
    }
  }

  // 2) soft dedup: multi-signal (name + day/weekend + place + urls)
  if (!existingId) {
    const day = ev.startDate.slice(0, 10);
    const prev = new Date(`${day}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const from = prev.toISOString().slice(0, 10);
    const to = next.toISOString().slice(0, 10);
    const spanEnd = (ev.endDate ?? ev.startDate).slice(0, 10);

    const eventCols =
      "id, name, start_date, end_date, fingerprint, status, website_url, registration_url, series:series(name), location:locations(lat, lng, name, municipality), sources:event_sources(source_url)";

    const { data: nearbyDays } = await supabase
      .from("events")
      .select(eventCols)
      .gte("start_date", from)
      .lte("start_date", to)
      .neq("status", "cancelled")
      .limit(400);

    const byId = new Map<string, CandidateRow>(
      ((nearbyDays ?? []) as unknown as CandidateRow[]).map((r) => [r.id, r]),
    );

    // Multi-day races (stage races, Fri–Sun cups) start before our window but
    // still cover this day — a single-day mirror must find them.
    const { data: spanning } = await supabase
      .from("events")
      .select(eventCols)
      .lt("start_date", from)
      .gte("end_date", from)
      .lte("start_date", spanEnd)
      .neq("status", "cancelled")
      .limit(120);
    for (const row of (spanning ?? []) as unknown as CandidateRow[]) byId.set(row.id, row);

    if (ev.lat != null && ev.lng != null) {
      const { data: nearLocs } = await supabase
        .from("locations")
        .select("id")
        .gte("lat", ev.lat - 0.35)
        .lte("lat", ev.lat + 0.35)
        .gte("lng", ev.lng - 0.5)
        .lte("lng", ev.lng + 0.5)
        .limit(80);
      const locIds = (nearLocs ?? []).map((l) => l.id as string);
      if (locIds.length) {
        const { data: nearbyGeo } = await supabase
          .from("events")
          .select(eventCols)
          .gte("start_date", from)
          .lte("start_date", to)
          .neq("status", "cancelled")
          .in("location_id", locIds)
          .limit(80);
        for (const row of (nearbyGeo ?? []) as unknown as CandidateRow[]) byId.set(row.id, row);
      }
    }

    const best = pickBestDuplicate(
      incomingDedup,
      [...byId.values()].map((r) => asCandidate(r)),
    );
    existingId = best?.row.id;
  }

  const { data: existingFull } = existingId
    ? await supabase
        .from("events")
        .select(
          "id, name, start_date, end_date, level, uci_class, class_label, audience, age_categories, status, visibility, website_url, overrides:event_overrides(locked_fields)",
        )
        .eq("id", existingId)
        .maybeSingle()
    : { data: byFp };

  const locked =
    (existingFull as { overrides?: { locked_fields?: string[] } | { locked_fields?: string[] }[] } | null)
      ?.overrides;
  const lockedFields = Array.isArray(locked)
    ? locked[0]?.locked_fields ?? []
    : locked?.locked_fields ?? [];

  const { shouldIngestByCountry, isRoughlyInEurope } = await import("@/lib/geo/europe");
  const { timezoneForCountry } = await import("@/lib/geo/timezones");
  let ingestCountry = (ev.countryHint || "").trim().toUpperCase() || null;
  // Drop explicit non-European races early (before locations / geocode queue)
  if (ev.countryHint && !shouldIngestByCountry(ev.countryHint)) {
    return null;
  }
  if (
    ev.lat != null &&
    ev.lng != null &&
    !ev.countryHint &&
    !isRoughlyInEurope(ev.lat, ev.lng)
  ) {
    return null;
  }

  let locationId: string | null = null;
  if (ev.placeText) {
    let lat = ev.lat ?? null;
    let lng = ev.lng ?? null;
    let country = ev.countryHint ?? "CZ";
    let geocodeStatus = lat != null ? "ok" : "pending";
    let geocodeQuery = ev.placeText;
    if (lat == null) {
      try {
        const { geocodeFromGazetteer, cleanGeocodeQuery } = await import("@/lib/geocode");
        const placeLooksJunk = /^(uci\s*(c[123]|cn)|unknown|silnice)$/i.test(ev.placeText.trim());
        const source = placeLooksJunk && ev.name ? ev.name : ev.placeText;
        const cleaned = cleanGeocodeQuery(source, ev.countryHint);
        if (cleaned.query) geocodeQuery = cleaned.query;
        country = cleaned.countryCode || country;
        const geo =
          geocodeFromGazetteer(source, ev.countryHint) ||
          (placeLooksJunk ? geocodeFromGazetteer(ev.name, ev.countryHint) : null);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          country = geo.countryCode || cleaned.countryCode || country;
          geocodeStatus = "ok";
        }
      } catch {
        /* ignore */
      }
    }

    ingestCountry = country;
    if (!shouldIngestByCountry(country)) {
      return null;
    }

    // Reuse an existing location with same query + country (cuts geocode queue growth)
    const { data: reused } = await supabase
      .from("locations")
      .select("id, lat, lng")
      .eq("geocode_query", geocodeQuery)
      .eq("country_code", country)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reused?.id) {
      locationId = reused.id;
      if (reused.lat == null && lat != null && lng != null) {
        await supabase
          .from("locations")
          .update({
            lat,
            lng,
            geocode_status: "ok",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reused.id);
        await supabase.rpc("set_location_geog", {
          loc_id: reused.id,
          lng,
          lat,
        });
      }
    } else {
      const { data: loc } = await supabase
        .from("locations")
        .insert({
          name: ev.placeText,
          municipality: geocodeQuery,
          country_code: country,
          lat,
          lng,
          geocode_query: geocodeQuery,
          geocode_status: geocodeStatus,
          timezone: timezoneForCountry(country),
        })
        .select("id")
        .single();
      locationId = loc?.id ?? null;
      if (locationId && lat != null && lng != null) {
        await supabase.rpc("set_location_geog", {
          loc_id: locationId,
          lng,
          lat,
        });
      }
    }
  }

  const { isNonRaceEventName } = await import("@/lib/event-visibility");
  const { isNonCyclingEventName } = await import("@/lib/sport-gate");
  // Regional calendars mix club triathlons and charity runs in with the road
  // races. Judge on the source's own words only — our inferred disciplines
  // cannot vouch for an entry, since a wrong discipline is what we are catching.
  const nonCycling = isNonCyclingEventName(
    ev.name,
    (ev.categories ?? []).map((c) => c.name).join(" "),
  );
  const hideAsNonRace = isNonRaceEventName(ev.name) || nonCycling;

  const existingRow = existingFull as {
    id?: string;
    name?: string;
    start_date?: string;
    end_date?: string;
    level?: string;
    uci_class?: string | null;
    class_label?: string | null;
    audience?: string | null;
    age_categories?: string[] | null;
    status?: string | null;
    visibility?: string | null;
    website_url?: string | null;
  } | null;

  const { isCancelledRaceName, shouldTreatAsReschedule } = await import(
    "@/lib/plan-changes"
  );
  let beforeSnap: import("@/lib/plan-changes").EventSnapshot | null = null;
  if (existingId) {
    const { data: snap } = await supabase
      .from("events")
      .select("name, start_date, end_date, status, disciplines, registration_url")
      .eq("id", existingId)
      .maybeSingle();
    if (snap) {
      beforeSnap = {
        name: snap.name,
        startDate: snap.start_date,
        endDate: snap.end_date,
        status: snap.status,
        disciplines: snap.disciplines ?? [],
        registrationUrl: snap.registration_url,
      };
    }
  }

  const website = preferDeeperOfficialUrl(incomingWebsite, existingRow?.website_url ?? null);
  const registration = incomingRegistration;

  let mergedName = ev.name;
  let mergedStart = ev.startDate;
  let mergedEnd = ev.endDate ?? ev.startDate;
  let mergedLevel: { level: string; uciClass: string | null; classLabel: string | null } = {
    level: levelInfo.level,
    uciClass: levelInfo.uciClass,
    classLabel: levelInfo.classLabel,
  };

  if (existingId && existingRow?.start_date) {
    if (beforeSnap && shouldTreatAsReschedule(beforeSnap.startDate, ev.startDate)) {
      mergedStart = ev.startDate;
      mergedEnd = ev.endDate ?? ev.startDate;
    } else {
      const span = mergeDateSpan(
        { startDate: existingRow.start_date, endDate: existingRow.end_date },
        { startDate: ev.startDate, endDate: ev.endDate ?? ev.startDate },
      );
      mergedStart = span.startDate;
      mergedEnd = span.endDate;
    }
    mergedName = preferEventName(existingRow.name || ev.name, ev.name);
    mergedLevel = preferLevel(
      {
        level: existingRow.level,
        uciClass: existingRow.uci_class,
        classLabel: existingRow.class_label,
      },
      {
        level: levelInfo.level,
        uciClass: levelInfo.uciClass,
        classLabel: levelInfo.classLabel,
      },
      classified.levelReason !== "default",
    );
  }

  /**
   * Ages used to be unioned on every pass, so one source's guess stuck to the
   * row forever — a UCI World Championship carried "kids" for a season because
   * a kids-cup adapter had seen the same weekend. Evidence from the name or
   * category list now replaces the stored set; a level/discipline default only
   * fills a row that has nothing.
   */
  const mergedAgeCategories =
    classified.ageConfidence === "explicit"
      ? classified.ageCategories
      : unionText(existingRow?.age_categories, classified.ageCategories);
  const mergedAudience = mergedAgeCategories.length
    ? audienceFromAgeCategories(
        mergedAgeCategories as import("@/lib/taxonomy").AgeCategory[],
      )
    : audience;

  const payload: Record<string, unknown> = {
    name: mergedName,
    name_normalized: normalizeName(mergedName),
    start_date: mergedStart,
    end_date: mergedEnd,
    disciplines,
    formats: classified.formats,
    audience: mergedAudience,
    age_categories: mergedAgeCategories,
    event_type: classified.eventType,
    competition_type: classified.competitionType,
    season: classified.season || mergedStart.slice(0, 4),
    timezone: timezoneForCountry(ev.countryHint),
    fingerprint: fingerprint({
      startDate: mergedStart,
      name: mergedName,
      lat: ev.lat,
      lng: ev.lng,
    }),
    source_kind: "scraped",
    level: mergedLevel.level,
    class_label: mergedLevel.classLabel ?? null,
    uci_class: mergedLevel.uciClass ?? null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Never let another sport into the catalog in the first place. Rows that are
  // already here get hidden below instead, so a manual unhide still sticks.
  if (nonCycling && !existingId) return null;

  const { shouldSkipUnlinkedDumpInsert } = await import("@/lib/event-visibility");
  const skipDump = shouldSkipUnlinkedDumpInsert({
    websiteUrl: website,
    registrationUrl: registration,
    location: { countryCode: ingestCountry },
  });
  if (skipDump && !existingId) {
    return null;
  }

  if (hideAsNonRace && !lockedFields.includes("visibility")) {
    payload.visibility = "hidden";
    payload.event_type = "training";
  } else if (skipDump && !lockedFields.includes("visibility")) {
    payload.visibility = "hidden";
  } else if (
    existingRow?.visibility === "hidden" &&
    audience === "kids" &&
    !lockedFields.includes("visibility")
  ) {
    payload.visibility = "public";
    if (existingRow.status === "hidden" && !lockedFields.includes("status")) {
      payload.status = "scheduled";
    }
  }

  if (beforeSnap && isCancelledRaceName(mergedName) && !lockedFields.includes("status")) {
    payload.status = "cancelled";
  }

  // Only write website/registration when we have a real race URL (never wipe with aggregator)
  if (website) payload.website_url = website;
  else if (!existingId) payload.website_url = null;
  if (registration) payload.registration_url = registration;
  else if (!existingId) payload.registration_url = null;
  else if (incomingWebsite?.includes("enduroserie.cz")) {
    const { data: cur } = await supabase
      .from("events")
      .select("registration_url")
      .eq("id", existingId)
      .maybeSingle();
    if (isStartListUrl(cur?.registration_url as string | null)) {
      payload.registration_url = null;
    }
  }
  if (incomingRegulations) {
    let existingRegulations: string | null = null;
    if (existingId) {
      const { data: cur } = await supabase
        .from("events")
        .select("regulations_url")
        .eq("id", existingId)
        .maybeSingle();
      existingRegulations = (cur?.regulations_url as string | null) ?? null;
    }
    const regulations = preferRegulationsUrl(incomingRegulations, existingRegulations);
    if (regulations) payload.regulations_url = regulations;
  }

  if (incomingResults) payload.results_url = incomingResults;

  if (!lockedFields.includes("location_id") && locationId) {
    payload.location_id = locationId;
  }

  // Attach / create series (Talent Cup, KPŽ, …)
  if (ev.seriesName || ev.seriesSlug) {
    const seriesId = await resolveSeriesId(supabase, ev, classified, publicRaceUrl);
    if (seriesId && !lockedFields.includes("series_id")) {
      payload.series_id = seriesId;
    }
  }

  for (const key of lockedFields) {
    delete payload[key];
  }

  let eventId = existingId;
  if (eventId) {
    await supabase.from("events").update(payload).eq("id", eventId);
  } else {
    const slug = slugifyEvent(ev.name, ev.startDate);
    const { data, error } = await supabase
      .from("events")
      .insert({ ...payload, slug })
      .select("id")
      .single();
    if (error) {
      const { data: d2 } = await supabase
        .from("events")
        .insert({ ...payload, slug: `${slug}-${Date.now().toString(36)}` })
        .select("id")
        .single();
      eventId = d2?.id;
    } else {
      eventId = data.id;
    }
  }

  if (!eventId) return null;

  if (beforeSnap) {
    try {
      const { recordEventPlanChanges } = await import("@/lib/plan-changes-db");
      await recordEventPlanChanges(supabase, eventId, beforeSnap, {
        name: mergedName,
        startDate: mergedStart,
        endDate: mergedEnd,
        status: typeof payload.status === "string" ? payload.status : beforeSnap.status,
        disciplines: classified.disciplines.length ? classified.disciplines : beforeSnap.disciplines,
        registrationUrl:
          typeof payload.registration_url === "string"
            ? payload.registration_url
            : beforeSnap.registrationUrl,
      });
    } catch (err) {
      console.error("recordEventPlanChanges", err);
    }
  }

  await supabase.from("event_sources").upsert(
    {
      event_id: eventId,
      watched_url_id: watchedUrlId,
      source_url: ev.sourceUrl,
      external_id: ev.externalId,
      kind:
        watchedKind === "federation"
          ? "national_federation"
          : watchedKind === "aggregator"
            ? "aggregator"
            : watchedKind === "series"
              ? "series"
              : "official",
      is_canonical: true,
    },
    { onConflict: "watched_url_id,external_id" },
  );

  if (ev.categories?.length) {
    await supabase.from("event_categories").delete().eq("event_id", eventId);
    await supabase.from("event_categories").insert(
      ev.categories.map((c) => ({
        event_id: eventId,
        name: c.name,
        distance_km: c.distanceKm ?? null,
        age_min: c.ageMin ?? null,
        age_max: c.ageMax ?? null,
        audience: c.audience ?? ev.audience ?? null,
      })),
    );
  }

  return eventId;
}

export async function previewUrl(url: string) {
  const fetched = await fetchPage(url);
  if (fetched.status >= 400) {
    return { ok: false as const, error: `HTTP ${fetched.status}`, events: [] as ParsedEvent[] };
  }
  const extracted = await extractEvents(url, fetched.html);
  return {
    ok: true as const,
    strategy: extracted.strategy,
    confidence: extracted.confidence,
    events: extracted.events,
    childUrls: extracted.childUrls,
  };
}
