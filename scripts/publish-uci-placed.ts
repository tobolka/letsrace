/**
 * Publish UCI directory competitions whose venue the directory gives only as a street, with the town proven by the
 * organiser's own website (the competition's website host): the town and a literal quote from that page are checked
 * again by the review gate before anything is written.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/publish-uci-placed.ts places.json [--apply]
 *   places.json: [{ "uci": "<directory id>", "place": "Brno", "sourceUrl": "https://…", "quote": "text as on the page" }]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { load } from "cheerio";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const apply = process.argv.includes("--apply");
  const places = JSON.parse(readFileSync(process.argv.find((a) => a.endsWith(".json"))!, "utf8")) as { uci: string; place: string; sourceUrl: string; quote: string }[];
  const ucd = await import("../src/lib/catalog/uci-directory");
  const { fetchPage } = await import("../src/lib/watcher/http");
  const { saveCandidate } = await import("../src/lib/discovery/review");
  const { validateReviewSource } = await import("../src/lib/discovery/review-source");
  const { ingestReviewedCandidate } = await import("../src/lib/watcher/run");
  const { catalogueWindow } = await import("../src/lib/catalog/overview-quality");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  for (const item of places) {
    const competition = await ucd.readUciDirectoryCompetition(item.uci);
    const event = ucd.uciDirectoryEvent(competition);
    if (!event) { console.log(`${item.uci}: not a race the catalogue carries`); continue; }
    const page = await fetchPage(item.sourceUrl, { fresh: true });
    const $ = load(page.html); $("script,style,noscript,template,[hidden],[aria-hidden=true]").remove();
    const visible = $.text().normalize("NFC").toLowerCase().replace(/\s+/g, " ");
    if (page.status !== 200 || !visible.includes(item.quote.normalize("NFC").toLowerCase().replace(/\s+/g, " ")) || !item.quote.toLowerCase().includes(item.place.toLowerCase())) { console.log(`${event.name}: the quote is not on ${item.sourceUrl}`); continue; }
    event.placeText = item.place;
    event.fieldEvidence = [{ field: "placeText", value: item.place, sourceUrl: item.sourceUrl, quote: item.quote, documentHash: hash(page.html) }];
    console.log(`${event.startDate} ${event.name} | ${competition.venue} → ${item.place} (${new URL(item.sourceUrl).hostname})${apply ? "" : " dry"}`);
    if (!apply) continue;
    try {
      const body = JSON.stringify(competition);
      const saved = await saveCandidate(db, event, { sourceUrl: event.sourceUrl, documentHash: hash(body), textHash: hash(body), reason: `UCI Competition Directory; town "${item.place}" from the organiser's site`, country: event.countryHint });
      if (saved.rejected) throw Error("already rejected");
      const { data: candidate, error: candidateError } = await db.from("pipeline_candidates").select("*").eq("candidate_key", saved.candidate_key).eq("evidence_hash", saved.evidence_hash).single();
      if (candidateError) throw candidateError;
      const review = { id: candidate.id, evidenceHash: candidate.evidence_hash, action: "publish" as const, reason: "The UCI registers this competition; its town is stated on the organiser's own website.", expectedEventId: null, authority: "official" as const, checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
      await validateReviewSource(candidate, review, catalogueWindow().from);
      const { data: claim, error: claimError } = await db.rpc("pipeline_claim_candidate", { p_id: candidate.id, p_hash: candidate.evidence_hash, p_updated: candidate.updated_at, p_decision: review as never, p_retry_resolved: false });
      if (claimError) throw claimError;
      const receipt = claim as { status?: string; token?: string } | null;
      if (!receipt?.token || receipt.status !== "publishing") throw Error("not claimed");
      await ingestReviewedCandidate(candidate, review, { id: candidate.id, evidenceHash: candidate.evidence_hash, token: receipt.token });
      console.log("  published");
    } catch (failure) { console.log(`  failed: ${(failure instanceof Error ? failure.message : String(failure)).slice(0, 200)}`); }
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
