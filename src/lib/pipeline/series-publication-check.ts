import type { Locale } from "@/lib/i18n/messages";
import { checkPublicationLocales, publicationLocaleWaves } from "@/lib/pipeline/publication-locales";
import { load } from "cheerio";
import { readPublicSeries } from "@/lib/events";
import { eventPagePath } from "@/lib/event-url";
import { compactRaceDates } from "@/lib/i18n/dates";
import { publicationPayload } from "@/lib/pipeline/publication";
import { createServerSupabase } from "@/lib/supabase/server";

type PublicSeries = Awaited<ReturnType<typeof readPublicSeries>>;
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

export function verifyPublicSeries(html: string, status: number, expected: PublicSeries, locale: Locale) {
  if (!expected) {
    if (status !== 404 && status !== 410) throw Error(`Hidden series still publicly available (HTTP ${status})`);
    return;
  }
  if (status !== 200) throw Error(`Series page returned HTTP ${status}`);
  const $ = load(html);
  const article = $("article").filter((_, el) => $(el).find(".browse-intro h1[data-page-title]").length > 0);
  if (article.length !== 1 || normalize(article.find("h1[data-page-title]").text()) !== normalize(expected.series.name)) {
    throw Error("Public series name does not match the saved series");
  }
  if (locale === "cs" && expected.series.description?.trim()
      && normalize(article.find(".browse-intro p").first().text()) !== normalize(expected.series.description)) {
    throw Error("Public series description does not match the saved series");
  }
  // React can stream the round rows separately from the article. The link
  // identifies its owning series in the HTML without interpreting scripts.
  const rows = $("a.race-row-link[data-series-round]").filter((_, row) =>
    $(row).attr("data-series-round") === expected.series.slug,
  ).toArray();
  const rounds = new Map(rows.map(row => [$(row).attr("href"), $(row)]));
  if (rows.length !== expected.events.length || rounds.size !== rows.length) throw Error("Public series round count does not match the saved series");
  const names = $(".race-row-name[data-series-race]").toArray();
  const nameBySlug = new Map(names.map(row => [$(row).attr("data-series-race"), $(row).text()]));
  const metadataRows = $(".race-row-meta[data-series-race]").toArray();
  const metaBySlug = new Map(metadataRows.map(row => [$(row).attr("data-series-race"), $(row)]));
  if (names.length !== expected.events.length || nameBySlug.size !== names.length
      || metadataRows.length !== expected.events.length || metaBySlug.size !== metadataRows.length) {
    throw Error("Public series round metadata count does not match the saved series");
  }
  for (const event of expected.events) {
    const row = rounds.get(eventPagePath(locale, event.slug));
    const meta = metaBySlug.get(event.slug);
    const date = meta?.find("time");
    const place = normalize([event.location?.municipality || event.location?.name || "—", event.location?.countryCode].filter(Boolean).join(" · "));
    const metadata = normalize(meta?.find(".race-row-place").text() ?? "");
    if (!row || normalize(nameBySlug.get(event.slug) ?? "") !== normalize(event.name)
        || date?.attr("datetime") !== event.startDate || normalize(date.text()) !== normalize(compactRaceDates(event, locale))
        || (metadata !== place && !metadata.startsWith(`${place} · `))) {
      throw Error(`Public series round does not match the saved race: ${event.slug}`);
    }
  }
}

export async function checkPublicSeriesRevisions({ maxChecks, deadline, timeoutMs }: { maxChecks: number; deadline: number; timeoutMs: number }) {
  const db = createServerSupabase();
  let processed = 0, verified = 0, deferred = 0;
  for (let index = 0; index < maxChecks && Date.now() + publicationLocaleWaves.length * timeoutMs + 2000 < deadline; index++) {
    const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "series_refresh", p_capabilities: ["web"], p_limit: 1 });
    if (error) throw error;
    const task = tasks[0];
    if (!task) break;
    processed++;
    try {
      const payload = publicationPayload(task.payload);
      const expected = await readPublicSeries(payload.slug);
      if (payload.expected.visibility === "public" ? expected?.series.id !== task.entity_id : expected !== null) {
        throw Error("Series changed while checking publication");
      }
      const checkedLocales = await checkPublicationLocales(`series/${payload.slug}`, timeoutMs, (html, status, locale) => {
        verifyPublicSeries(html, status, expected, locale);
      });
      const { data: finished, error } = await db.rpc("pipeline_finish_task", {
        p_key: task.key, p_token: task.token!, p_payload: task.payload,
        p_result: { verified: true, verifiedAt: new Date().toISOString(), revision: payload.revision, locales: checkedLocales, rounds: expected?.events.length ?? 0 },
      });
      if (error) throw error;
      if (finished) verified++; else deferred++;
    } catch (error) {
      const retry = await db.rpc("pipeline_retry_task", {
        p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Series publication check failed",
        p_delay_seconds: Math.min(86400, 300 * 2 ** Math.min(task.attempts, 8)),
      });
      if (retry.error) throw retry.error;
      deferred++;
    }
  }
  return { processed, verified, deferred };
}
