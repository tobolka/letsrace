import { createHash } from "node:crypto";
import { load } from "cheerio";
import { parseFullgazHomepage } from "@/lib/watcher/extractors/fullgaz";
import { parseSwissCycling } from "@/lib/watcher/extractors/swisscycling";
import { parseSportsoftRegistration } from "@/lib/watcher/extractors/sportsoft";
import { parseUciCompetition } from "@/lib/watcher/extractors/uci-competition";
import { uciDirectoryApi, uciDirectoryEvent, uciDirectoryId } from "@/lib/catalog/uci-directory";
import { radsportEventsApiUrl, radsportEventsId, radsportEventsParsedEvent } from "@/lib/catalog/radsport-events";
import { discoveryUrl } from "./plan";
import type { Json } from "@/lib/supabase/database.types";
import type { ParsedEvent } from "@/lib/domain";
import { fetchPage } from "@/lib/watcher/http";
import { pageAsText } from "@/lib/watcher/extractors/llm-calendar";
import { sameCandidateFacts, validateReview, type ReviewDecision, type ReviewRow } from "./review";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const literal = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

async function verifyFieldEvidence(event: ParsedEvent, authorityWebsite: string | undefined, read: typeof fetchPage) {
  if (!event.fieldEvidence) return;
  if (event.fieldEvidence.length !== 1 || !authorityWebsite) throw Error("Invalid supplementary evidence");
  const proof = event.fieldEvidence[0];
  const host = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  if (proof.field !== "placeText" || proof.value !== event.placeText || !proof.value.trim() || !discoveryUrl(proof.sourceUrl)
    || host(proof.sourceUrl) !== host(authorityWebsite) || !/^[a-f0-9]{64}$/.test(proof.documentHash)) throw Error("Invalid supplementary place source");
  const document = await read(proof.sourceUrl, { fresh: true });
  const $ = load(document.html); $("script,style,noscript,template,[hidden],[aria-hidden=true]").remove();
  const visible = literal($.text());
  if (document.status !== 200 || hash(document.html) !== proof.documentHash || !literal(proof.quote).includes(literal(proof.value)) || !visible.includes(literal(proof.quote))) throw Error("Supplementary place evidence changed or is not present");
}

export class ReviewSourceChangedError extends Error {}

/** The same gate is used for preview and by the reviewed writer before any write. */
export async function validateReviewSource(row: ReviewRow, decision: ReviewDecision, today: string, read: typeof fetchPage = fetchPage) {
  validateReview(row, decision, today);
  if (decision.action !== "publish") throw Error("Publication requires a publish decision");
  if ((row.payload as unknown as ParsedEvent).evidence?.method === "uci_directory") {
    // The directory's pages are an app shell; its API is the document. Re-read it and compare the whole assertion.
    const event = row.payload as unknown as ParsedEvent;
    const id = uciDirectoryId(row.source_url);
    if (!id) throw Error("Not a UCI directory competition");
    const fresh = await read(uciDirectoryApi(id), { fresh: true, accept: "application/json" });
    if (fresh.status !== 200) throw Error(`Source unavailable: ${row.id} (HTTP ${fresh.status})`);
    let parsed: ParsedEvent | null = null;
    try { parsed = uciDirectoryEvent(JSON.parse(fresh.html)); } catch { parsed = null; }
    // A venue the directory gives only as a street may be placed by the organiser's own website (the competition's
    // website host): the proof is checked below; every other fact still has to equal the directory's.
    const asserted = { ...event } as ParsedEvent; delete asserted.fieldEvidence;
    if (event.fieldEvidence) asserted.placeText = parsed?.placeText ?? "";
    if (!parsed || parsed.evidence?.quote !== event.evidence?.quote || parsed.evidence?.version !== event.evidence?.version
      || !sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, JSON.parse(JSON.stringify(asserted)) as Json)) throw Error("UCI directory competition differs from the current directory");
    await verifyFieldEvidence(event, parsed.websiteUrl, read);
    return;
  }
  if ((row.payload as unknown as ParsedEvent).evidence?.method === "radsport_events") {
    const event = row.payload as unknown as ParsedEvent;
    const id = radsportEventsId(row.source_url);
    if (!id) throw Error("Not a radsport-events.de event");
    const fresh = await read(radsportEventsApiUrl(id), { fresh: true, accept: "application/json" });
    if (fresh.status !== 200) throw Error(`Source unavailable: ${row.id} (HTTP ${fresh.status})`);
    let parsed: ParsedEvent | null = null;
    try { parsed = radsportEventsParsedEvent(JSON.parse(fresh.html)); } catch { parsed = null; }
    if (!parsed || parsed.evidence?.quote !== event.evidence?.quote || parsed.evidence?.version !== event.evidence?.version
      || !sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, JSON.parse(JSON.stringify(event)) as Json)) {
      throw Error("radsport-events.de item differs from current API");
    }
    return;
  }
  const source = await read(row.source_url, { fresh: true });
  const evidence = row.evidence as { documentHash?: string; textHash?: string } | null;
  const event = row.payload as unknown as ParsedEvent;
  const text = pageAsText(source.html, row.source_url).text;
  const structured = ["structured_calendar", "uci_competition"].includes(event.evidence?.method ?? "");
  const sameDocument = evidence?.textHash && !structured ? hash(text) === evidence.textHash : Boolean(evidence?.documentHash && hash(source.html) === evidence.documentHash);
  // Known deterministic readers re-check their complete assertion below. A changed
  // navigation/script hash alone must not invalidate identical official facts.
  const recheckedReader = ["uci_competition", "official_annual_announcement", "swiss_cycling_table", "sportsoft_registration"].includes(event.evidence?.method ?? "");
  if (source.status !== 200) throw Error(`Source unavailable: ${row.id} (HTTP ${source.status})`);
  if (event.evidence?.method === "sportsoft_registration") {
    const [parsed] = parseSportsoftRegistration(row.source_url, source.html);
    if (!parsed || parsed.evidence?.version !== event.evidence.version
      || !sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, row.payload)) {
      throw new ReviewSourceChangedError("Sportsoft registration differs from the current event header");
    }
    return;
  }
  if (!sameDocument && !recheckedReader) throw new ReviewSourceChangedError(`Source changed or unavailable: ${row.id}; re-read and review`);
  if (event.evidence?.method === "swiss_cycling_table") {
    const parsed = parseSwissCycling(row.source_url, source.html).find(item => item.externalId === event.externalId);
    if (!parsed || parsed.evidence?.version !== event.evidence.version
      || !sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, row.payload)) {
      throw new ReviewSourceChangedError("Swiss calendar row differs from the current federation calendar");
    }
    return;
  }
  if (event.evidence?.method === "uci_competition") {
    const [parsed] = parseUciCompetition(row.source_url, source.html);
    if (!parsed || parsed.evidence?.quote !== event.evidence.quote || parsed.evidence?.version !== event.evidence.version) throw Error("UCI component evidence changed or is not present");
    const asserted = { ...event }; delete asserted.fieldEvidence;
    if (event.fieldEvidence) asserted.placeText = parsed.placeText;
    if (!sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, JSON.parse(JSON.stringify(asserted)) as Json)) throw Error("UCI assertion differs from the actual competition component");
    await verifyFieldEvidence(event, parsed.websiteUrl, read);
    return;
  }
  if (event.evidence?.method === "official_annual_announcement") {
    const [parsed] = await parseFullgazHomepage(row.source_url, source.html, read);
    if (!parsed || parsed.evidence?.quote !== event.evidence.quote || parsed.evidence?.version !== event.evidence.version
      || !sameCandidateFacts(JSON.parse(JSON.stringify(parsed)) as Json, row.payload)) throw Error("Annual announcement differs from the current official sources");
    return;
  }
  if (event.fieldEvidence) throw Error("Supplementary evidence requires a supported structured reader");
  if (structured && event.evidence!.quote.trim().startsWith("<")) {
    // Structured readers retain the actual card markup, including time[datetime].
    // Compare serialized fragments with the same parser, not markup to plain text.
    const fragment = load(event.evidence!.quote, null, false).html();
    if (!fragment?.trim() || !literal(load(source.html).html()).includes(literal(fragment))) throw Error("Review quote is not present in the source document");
    return;
  }
  // Readers may assemble a title, season heading and date row on separate lines.
  // Each fragment still has to occur literally; model assertions are not evidence.
  const $ = load(source.html);
  $("script,style,noscript,template,[hidden],[aria-hidden=true]").remove();
  $("br").replaceWith(" ");
  $("p,div,li,tr,h1,h2,h3,h4,h5,h6,section,article,td,th,dt,dd").append(" ");
  const visible = literal(`${$("title").text()} ${$("body").text()}`);
  const linkedText = literal(pageAsText($.html(), row.source_url).text);
  const fragments = event.evidence!.quote.split(/\r?\n/).map(literal).filter(Boolean);
  if (!fragments.length || fragments.some(fragment => !visible.includes(fragment) && !linkedText.includes(fragment))) throw Error("Review quote is not present in the source document");
}
