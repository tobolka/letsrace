/**
 * Hand the agent's verified findings to the gate. This is the only place where anything the
 * agent said reaches the server, and only as a proposal: pipeline_apply_proposal decides, under
 * the same locks and rules as for every other reader, and what it writes can be rolled back.
 *
 *   tsx scripts/agent-apply.ts --answers=<dir> [--apply]
 *
 * Without --apply it only says what it would hand in. A finding goes on only if
 *   - agent-verify found its quote on the page it names,
 *   - the document is about this race by the same test the readers use, and
 *   - it is not simply the race's own page, which we already hold.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "dotenv";
import { distinctiveWords, documentIsAboutRace } from "../src/lib/catalog/race-completeness";
import { quoteStatesDate } from "../src/lib/catalog/quoted-date";
import { readDocument } from "../src/lib/catalog/regulation-ages";

export const AGENT_READER = "agent", AGENT_VERSION = "agent-1";
const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const samePage = (a: string | null, b: string | null) => { try { const norm = (u: string) => { const url = new URL(u); return url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "") + url.search; }; return Boolean(a && b) && norm(a!) === norm(b!); } catch { return false; } };

async function main() {
  const answers = arg("answers"); if (!answers) throw Error("--answers=<dir> is needed");
  const apply = process.argv.includes("--apply");
  const verified = JSON.parse(readFileSync(join(answers, "verified.json"), "utf8")) as { case: string; kind: string; verdict: string; verified: boolean | null; verifiedRaces?: number[]; checks?: { url: string; quoteFound: boolean }[] }[];
  const doneFile = join(answers, "applied.json");
  const done: Record<string, { at: string; outcome: string; reason?: string | null; key?: string }> = existsSync(doneFile) ? JSON.parse(readFileSync(doneFile, "utf8")) : {};
  const todo = verified.filter(row => row.kind === "find_regulations" && row.verdict === "found" && row.verified === true && !done[row.case]);
  // Doubles inside the catalogue, and races a calendar lists that we do not hold.
  const pairs = verified.filter(row => row.case.startsWith("pair-") && row.verified === true && ["same", "different"].includes(row.verdict) && !done[row.case]);
  const calendars = verified.filter(row => row.kind === "find_races" && row.verified === true && !done[row.case]);
  const totals: Record<string, number> = {};
  const note = (name: string, outcome: string, reason?: string | null, key?: string) => { totals[outcome] = (totals[outcome] ?? 0) + 1; if (apply) done[name] = { at: new Date().toISOString(), outcome, reason, key }; console.log(`${outcome}${reason ? ` (${reason})` : ""}: ${name}`); };
  if (todo.length) {
    for (const [key, value] of Object.entries(parse(readFileSync(resolve(__dirname, "..", ".env.local"), "utf8")))) process.env[key] ??= value;
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const db = createServerSupabase();
    // The generated types do not know the two new functions yet.
    const call = (name: string, params: object) => (db as unknown as { rpc(name: string, params: object): PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(name, params);
    for (const row of todo) {
      const answer = JSON.parse(readFileSync(join(answers, `${row.case}.json`), "utf8")).answer as { race: string; url: string; quote: string };
      const { data: race, error } = await db.from("events").select("id,name,start_date,website_url,regulations_url,location:locations(municipality)").eq("id", answer.race).maybeSingle();
      if (error) throw Error(error.message);
      // A race the Mac knows and the server does not is not ours to fill yet.
      if (!race) { note(row.case, "skipped", "race_not_on_server"); continue; }
      if (race.regulations_url) { note(row.case, "skipped", "field_filled"); continue; }
      if (samePage(answer.url, race.website_url)) { note(row.case, "skipped", "same_as_website"); continue; }
      const text = (await readDocument(answer.url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null))?.text ?? "";
      const location = race.location as { municipality?: string | null } | { municipality?: string | null }[] | null;
      const municipality = (Array.isArray(location) ? location[0]?.municipality : location?.municipality) ?? null;
      // Either the readers' own test says the document is about this race, or the agent's quote, which was found
      // on the page, states this race's day and month, the document carries the year, and it names the race or its town.
      // A series' regulations list every round's date in one line; the readers' test, written for one race a page, misses those.
      const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const page = fold(text), named = [...distinctiveWords(race.name), ...(municipality ? fold(municipality).split(/[^a-z0-9]+/).filter(word => word.length >= 4) : [])];
      // "11. 11., 18. 11., 25. 11., 2. 12. 2026": one of several days listed with their months, and the year in the same words.
      const [year, month, day] = race.start_date.split("-").map(Number);
      const inList = new RegExp(`(?<![\\d.])0?${day}\\.\\s*0?${month}\\.(?!\\d)`).test(answer.quote) && answer.quote.includes(String(year));
      const byQuote = (quoteStatesDate(answer.quote, race.start_date) || inList) && text.includes(race.start_date.slice(0, 4)) && named.some(word => page.includes(word));
      if (!documentIsAboutRace(text, { name: race.name, start_date: race.start_date, municipality }) && !byQuote) { note(row.case, "held", "not_clearly_this_race"); continue; }
      if (!apply) { note(row.case, "would_propose"); continue; }
      const submitted = await call("pipeline_submit_proposal", { p_event: race.id, p_field: "regulations_url", p_value: answer.url, p_source: answer.url, p_quote: answer.quote, p_reader: AGENT_READER, p_version: AGENT_VERSION, p_task: `agent:${row.case}` });
      if (submitted.error) throw Error(submitted.error.message);
      const decided = await call("pipeline_apply_proposal", { p_key: submitted.data as string });
      if (decided.error) throw Error(decided.error.message);
      const decision = decided.data as { status: string; reason: string | null };
      note(row.case, decision.status, decision.reason, submitted.data as string);
    }
  }
  if (pairs.length || calendars.length) {
    for (const [key, value] of Object.entries(parse(readFileSync(resolve(__dirname, "..", ".env.local"), "utf8")))) process.env[key] ??= value;
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const { differentInstalment, isSeparateRace, mergeEventPair, mergeKeeper } = await import("../src/lib/catalog/merge-duplicates");
    const { saveCandidate } = await import("../src/lib/discovery/review");
    const db = createServerSupabase();
    const samePageAs = (url: string, pages: (string | null | undefined)[]) => pages.some(page => samePage(url, page ?? null));
    for (const row of pairs) {
      const answer = JSON.parse(readFileSync(join(answers, `${row.case}.json`), "utf8")).answer as { a: string; b: string; note: string | null };
      const { data, error } = await db.from("events").select("id,name,start_date,end_date,website_url,registration_url,series_id,fingerprint,disciplines,visibility,merged_into_id,location:locations(lat,lng,name,municipality,country_code),series:series!events_series_id_fkey(name),sources:event_sources(id,watched_url_id,external_id,source_url),overrides:event_overrides(locked_fields)").in("id", [answer.a, answer.b]);
      if (error) throw Error(error.message);
      type Side = Omit<import("../src/lib/catalog/merge-duplicates").MergeDuplicateRow, "sources"> & { visibility: string | null; merged_into_id: string | null; sources: { id: string; watched_url_id: string | null; external_id: string | null; source_url: string | null }[] | null };
      const sides = (data ?? []) as unknown as Side[], a = sides.find(side => side.id === answer.a), b = sides.find(side => side.id === answer.b);
      if (!a || !b) { note(row.case, "skipped", "race_not_on_server"); continue; }
      if (a.merged_into_id || b.merged_into_id) { note(row.case, "skipped", "already_merged"); continue; }
      if (row.verdict === "different") {
        if (apply) {
          const [left, right] = [a.id, b.id].sort();
          const saved = await db.from("duplicate_reviews").upsert({ left_id: left!, right_id: right!, verdict: "separate", note: `agent: ${answer.note ?? ""}`.slice(0, 300) }, { onConflict: "left_id,right_id", ignoreDuplicates: true });
          if (saved.error) throw Error(saved.error.message);
        }
        note(row.case, apply ? "recorded_separate" : "would_record_separate"); continue;
      }
      // "same": the names must not say otherwise, the days must touch, and each race's own page must be among the quoted ones.
      if (a.visibility !== "public" || b.visibility !== "public") { note(row.case, "held", "not_both_public"); continue; }
      if (isSeparateRace(a.name, b.name) || differentInstalment(a.name, b.name)) { note(row.case, "held", "names_say_separate"); continue; }
      if (Math.abs(Date.parse(a.start_date) - Date.parse(b.start_date)) > 86_400_000) { note(row.case, "held", "days_apart"); continue; }
      const quoted = (row.checks ?? []).filter(check => check.quoteFound).map(check => check.url);
      const pagesOf = (side: Side) => [side.website_url, side.registration_url, ...(side.sources ?? []).map(source => source.source_url)];
      if (!quoted.some(url => samePageAs(url, pagesOf(a))) || !quoted.some(url => samePageAs(url, pagesOf(b)))) { note(row.case, "held", "evidence_from_one_side"); continue; }
      if (process.env.AGENT_MERGES === "0") { note(row.case, "held", "merges_switched_off"); continue; }
      if (!apply) { note(row.case, "would_merge"); continue; }
      const keep = mergeKeeper(a, b), drop = keep.id === a.id ? b : a;
      // Kept whole in pipeline_merge_history; scripts/restore-event-merge.ts undoes it.
      await mergeEventPair(keep.id, drop.id);
      note(row.case, "merged", null, `${keep.id}<-${drop.id}`);
    }
    for (const row of calendars) {
      const answer = JSON.parse(readFileSync(join(answers, `${row.case}.json`), "utf8")).answer as { source: string; races: { name: string; start_date: string; end_date: string | null; place: string | null; url: string; quote: string }[] };
      let saved = 0;
      for (const index of row.verifiedRaces ?? []) {
        const race = answer.races[index]; if (!race) continue;
        if (!apply) { saved++; continue; }
        const text = (await readDocument(race.url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null))?.text ?? "";
        // A candidate is a lead for the existing review, not a race: nothing is published from here.
        const event = { externalId: `agent:${createHash("md5").update(`${race.name}|${race.start_date}`).digest("hex").slice(0, 12)}`, name: race.name, startDate: race.start_date, ...(race.end_date ? { endDate: race.end_date } : {}), placeText: race.place ?? "", sourceUrl: race.url, evidence: { quote: race.quote, version: AGENT_VERSION } };
        await saveCandidate(db, event as never, { sourceUrl: race.url, documentHash: createHash("sha256").update(text).digest("hex"), reason: "agent_found_in_calendar" });
        saved++;
      }
      note(row.case, apply ? "candidates_saved" : "would_save_candidates", String(saved));
    }
  }
  if (apply) writeFileSync(doneFile, JSON.stringify(done, null, 1));
  console.log("agent_apply " + JSON.stringify({ apply, considered: todo.length + pairs.length + calendars.length, ...totals }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
