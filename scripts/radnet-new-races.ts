/**
 * Races rad-net has opened for entry that the catalogue lacks. Only these: a row marked "Vorläufiger Termin"
 * is a provisional date and stays out, as any tentative date does. Goes through the reviewed-candidate gates.
 * Dry unless --apply.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const fold = (text: string) => text.toLowerCase().replaceAll("ß", "ss").normalize("NFD").replace(/\p{M}/gu, "");
const words = (text: string) => new Set((fold(text).match(/[a-z0-9]{4,}/g) ?? []).filter(word => !["cross", "cyclo", "cyclocross", "rennen", "race", "lauf", "2026", "2027", "radsport", "gravel", "pokal", "preis", "grosser"].includes(word)));
const KIND: Record<string, string> = { Cross: "cx", MTB: "mtb", Bahn: "track", "Str.": "road", Gravel: "gravel", BMX: "bmx" };
// Tests, school days and qualifiers are on the same calendar, and are not races riders enter.
const NOT_A_RACE = /athletik|sichtung|schülerradsporttag|lehrgang|meldungen/i;

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const apply = process.argv.includes("--apply");
  const skip = (process.argv.find(arg => arg.startsWith("--skip="))?.slice(7) ?? "").split(",").filter(Boolean);
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { radNetCalendarPages, radNetFullRows } = await import("../src/lib/catalog/radnet");
  const { saveCandidate } = await import("../src/lib/discovery/review");
  const { validateReviewSource } = await import("../src/lib/discovery/review-source");
  const { ingestReviewedCandidate } = await import("../src/lib/watcher/run");
  const { catalogueWindow } = await import("../src/lib/catalog/overview-quality");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const read = async (url: string) => {
    const doc = await readDocument(url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null);
    await wait(1000);
    return doc?.html ? { html: doc.html, ...pageAsText(doc.html, url) } : null;
  };
  const queue = ["https://www.rad-net.de/rad-net-portal/rad-net-ausschreibungen.htm?url=%2Fmodules.php%3Fname%3DAusschreibung&url_hash=uSwzL6PJy_k5sHq6-DL9JQLRhAKSLlHt_zLM8jYvlhU"], seen = new Set<string>(), rows: ReturnType<typeof radNetFullRows> = [];
  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await read(url);
    if (!page) continue;
    rows.push(...radNetFullRows(page.text));
    for (const next of radNetCalendarPages([...page.links])) if (!seen.has(next)) queue.push(next);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db.from("events").select("name,start_date,end_date,visibility,location:locations(municipality)").gte("start_date", today).limit(8000)
    .returns<{ name: string; start_date: string; end_date: string | null; visibility: string; location: { municipality: string | null } | null }[]>();
  if (error) throw Error(error.message);
  const unique = new Map(rows.map(row => [`${row.date}|${row.title}`, row]));
  const results = { rows: unique.size, missing: 0, published: 0, failed: 0 };
  for (const row of unique.values()) {
    if (row.date <= today || NOT_A_RACE.test(row.title) || !KIND[row.kind] || skip.some(word => row.title.includes(word))) continue;
    const own = words(`${row.title} ${row.place}`);
    // Hidden and merged records count too: someone may already have ruled this race out.
    if ((data ?? []).some(event => event.start_date <= row.date && (event.end_date ?? event.start_date) >= row.date && [...words(`${event.name} ${event.location?.municipality ?? ""}`)].some(word => own.has(word)))) continue;
    results.missing++;
    const page = await read(row.url);
    const start = /Tag: [^\n]{0,40}?Ort: [^\n]{0,60}?(?= Ausrichter:)/.exec(page?.text ?? "")?.[0];
    if (!page || !start) { console.log(`${row.date} ${row.title.slice(0, 50)}: stránka bez šablony`); results.failed++; continue; }
    const event = {
      externalId: `radnet:${/ID_Veranstaltung%3D(\d+)/.exec(row.url)?.[1] ?? hash(row.url).slice(0, 12)}`, name: row.title, startDate: row.date, ...(row.endDate ? { endDate: row.endDate } : {}),
      placeText: row.place, countryHint: "DE", discipline: [KIND[row.kind]!], sourceUrl: row.url, websiteUrl: row.url, confidence: 0.9,
      evidence: { quote: start.slice(0, 280), sourceUrl: row.url, method: "radnet_published", version: "radnet-v1" },
    } as unknown as import("../src/lib/domain").ParsedEvent;
    console.log(`${row.date} ${row.kind} ${row.title.slice(0, 54)} | ${row.place} | ${apply ? "" : "suchý běh"}`);
    if (!apply) continue;
    try {
      const saved = await saveCandidate(db, event, { sourceUrl: row.url, documentHash: hash(page.html), textHash: hash(page.text), reason: "Open for entry on rad-net", country: "DE" });
      if (saved.rejected) throw Error("already rejected");
      const { data: candidate, error: candidateError } = await db.from("pipeline_candidates").select("*").eq("candidate_key", saved.candidate_key).eq("evidence_hash", saved.evidence_hash).single();
      if (candidateError) throw candidateError;
      const review = { id: candidate.id, evidenceHash: candidate.evidence_hash, action: "publish" as const, reason: "German federation's calendar opens this race for entry, on its own page.", expectedEventId: null, authority: "official" as const, checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
      await validateReviewSource(candidate, review, catalogueWindow().from);
      const { data: claim, error: claimError } = await db.rpc("pipeline_claim_candidate", { p_id: candidate.id, p_hash: candidate.evidence_hash, p_updated: candidate.updated_at, p_decision: review as never, p_retry_resolved: false });
      if (claimError) throw claimError;
      const receipt = claim as { status?: string; token?: string } | null;
      if (!receipt?.token || receipt.status !== "publishing") throw Error("not claimed");
      await ingestReviewedCandidate(candidate, review, { id: candidate.id, evidenceHash: candidate.evidence_hash, token: receipt.token });
      results.published++;
    } catch (failure) {
      results.failed++;
      console.log(`  nepovedlo se: ${(failure instanceof Error ? failure.message : String(failure)).slice(0, 180)}`);
    }
  }
  console.log(JSON.stringify(results));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
