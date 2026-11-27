import type { Locale } from "@/lib/i18n/messages";
import {
  DEFAULT_LOCALE_WAVE_DELAY_MS,
  RateLimitedPublication,
  checkPublicationLocales,
  publicationLocaleWaves,
} from "@/lib/pipeline/publication-locales";
import { MAX_EDGE_SECONDS } from "@/lib/cloudflare-edge-cache";
import { load } from "cheerio";
import { readPublicSeries } from "@/lib/events";
import { eventPagePath } from "@/lib/event-url";
import { compactRaceDates } from "@/lib/i18n/dates";
import { StalePublication, publicationPayload } from "@/lib/pipeline/publication";
import { createServerSupabase } from "@/lib/supabase/server";

type PublicSeries = Awaited<ReturnType<typeof readPublicSeries>>;
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

const EDGE_RETRY_BUFFER_SECONDS = 60;
const MIN_EDGE_RETRY_SECONDS = MAX_EDGE_SECONDS + EDGE_RETRY_BUFFER_SECONDS;
const MIN_RATE_LIMIT_RETRY_SECONDS = 300;
export const DEFAULT_BETWEEN_SERIES_CHECKS_MS = 350;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function isRateLimitedError(error: unknown): boolean {
  if (error instanceof RateLimitedPublication) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\bHTTP 429\b/i.test(message);
}

/** Wait past Cloudflare's edge TTL on stale HTML and at least 5 min when rate-limited. */
export function seriesRetryDelaySeconds(error: unknown, attempts = 0): number {
  const exponent = Number.isFinite(attempts) && attempts > 0 ? Math.min(Math.floor(attempts), 8) : 0;
  const backoff = Math.min(86400, 300 * 2 ** exponent);
  if (error instanceof StalePublication) return Math.max(MIN_EDGE_RETRY_SECONDS, backoff);
  if (isRateLimitedError(error)) return Math.max(MIN_RATE_LIMIT_RETRY_SECONDS, backoff);
  return backoff;
}

export function verifyPublicSeries(html: string, status: number, expected: PublicSeries, locale: Locale) {
  if (!expected) {
    if (status === 200) throw new StalePublication("Hidden series still publicly available (HTTP 200)");
    if (status !== 404 && status !== 410) throw Error(`Series page returned HTTP ${status}`);
    return;
  }
  if (status === 404 || status === 410) throw new StalePublication(`Series page returned HTTP ${status}`);
  if (status !== 200) throw Error(`Series page returned HTTP ${status}`);
  const $ = load(html);
  const article = $("article").filter((_, el) => $(el).find(".browse-intro h1[data-page-title]").length > 0);
  if (article.length !== 1 || normalize(article.find("h1[data-page-title]").text()) !== normalize(expected.series.name)) {
    throw new StalePublication("Public series name does not match the saved series");
  }
  if (locale === "cs" && expected.series.description?.trim()
      && normalize(article.find(".browse-intro p").first().text()) !== normalize(expected.series.description)) {
    throw new StalePublication("Public series description does not match the saved series");
  }
  // React can stream the round rows separately from the article. The link
  // identifies its owning series in the HTML without interpreting scripts.
  const rows = $("a.race-row-link[data-series-round]").filter((_, row) =>
    $(row).attr("data-series-round") === expected.series.slug,
  ).toArray();
  const rounds = new Map(rows.map(row => [$(row).attr("href"), $(row)]));
  if (rows.length !== expected.events.length || rounds.size !== rows.length) throw new StalePublication("Public series round count does not match the saved series");
  const names = $(".race-row-name[data-series-race]").toArray();
  const nameBySlug = new Map(names.map(row => [$(row).attr("data-series-race"), $(row).text()]));
  const metadataRows = $(".race-row-meta[data-series-race]").toArray();
  const metaBySlug = new Map(metadataRows.map(row => [$(row).attr("data-series-race"), $(row)]));
  if (names.length !== expected.events.length || nameBySlug.size !== names.length
      || metadataRows.length !== expected.events.length || metaBySlug.size !== metadataRows.length) {
    throw new StalePublication("Public series round metadata count does not match the saved series");
  }
  for (const event of expected.events) {
    const row = rounds.get(eventPagePath(locale, event.slug));
    const meta = metaBySlug.get(event.slug);
    const date = meta?.find("time");
    const place = normalize([event.location?.municipality || event.location?.name, event.location?.countryCode].filter(Boolean).join(" · "));
    const placeEl = meta?.find(".race-row-place[title]");
    const metadata = normalize((placeEl?.length ? placeEl.first() : meta?.find(".race-row-place").last())?.text() ?? "");
    if (!row || normalize(nameBySlug.get(event.slug) ?? "") !== normalize(event.name)
        || date?.attr("datetime") !== event.startDate || normalize(date.text()) !== normalize(compactRaceDates(event, locale))
        || (place !== "" && metadata !== place && !metadata.startsWith(`${place} · `))) {
      throw new StalePublication(`Public series round does not match the saved race: ${event.slug}`);
    }
  }
}

export async function checkPublicSeriesRevisions({
  maxChecks,
  deadline,
  timeoutMs,
  betweenChecksMs = DEFAULT_BETWEEN_SERIES_CHECKS_MS,
  waveDelayMs = DEFAULT_LOCALE_WAVE_DELAY_MS,
}: {
  maxChecks: number;
  deadline: number;
  timeoutMs: number;
  betweenChecksMs?: number;
  waveDelayMs?: number;
}) {
  const db = createServerSupabase();
  let processed = 0, verified = 0, deferred = 0;
  const waveSpreadMs = Math.max(0, publicationLocaleWaves.length - 1) * Math.max(0, waveDelayMs);
  for (let index = 0; index < maxChecks; index++) {
    const waitMs = index > 0 && betweenChecksMs > 0 ? betweenChecksMs : 0;
    if (Date.now() + waitMs + publicationLocaleWaves.length * timeoutMs + waveSpreadMs + 2000 >= deadline) break;
    if (waitMs > 0) await sleep(waitMs);
    const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "series_refresh", p_capabilities: ["web"], p_limit: 1 });
    if (error) throw error;
    const task = tasks[0];
    if (!task) break;
    processed++;
    let revision = "";
    try {
      const payload = publicationPayload(task.payload);
      revision = payload.revision;
      const expected = await readPublicSeries(payload.slug);
      if (payload.expected.visibility === "public" ? expected?.series.id !== task.entity_id : expected !== null) {
        throw Error("Series changed while checking publication");
      }
      const checkedLocales = await checkPublicationLocales(
        `series/${payload.slug}`,
        timeoutMs,
        (html, status, locale) => {
          verifyPublicSeries(html, status, expected, locale);
        },
        waveDelayMs,
      );
      const { data: finished, error } = await db.rpc("pipeline_finish_task", {
        p_key: task.key, p_token: task.token!, p_payload: task.payload,
        p_result: { verified: true, verifiedAt: new Date().toISOString(), revision: payload.revision, locales: checkedLocales, rounds: expected?.events.length ?? 0 },
      });
      if (error) throw error;
      if (finished) verified++; else deferred++;
    } catch (error) {
      const rateLimited = isRateLimitedError(error);
      const retry = await db.rpc("pipeline_retry_publication_check", {
        p_key: task.key, p_token: task.token!, p_revision: revision, p_stale: error instanceof StalePublication,
        p_error: error instanceof Error ? error.message : "Series publication check failed",
        p_delay_seconds: seriesRetryDelaySeconds(error, task.attempts),
      });
      if (retry.error) throw retry.error;
      deferred++;
      if (rateLimited) break;
    }
  }
  return { processed, verified, deferred };
}
