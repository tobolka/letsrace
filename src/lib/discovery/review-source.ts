import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { fetchPage } from "@/lib/watcher/http";
import { pageAsText } from "@/lib/watcher/extractors/llm-calendar";
import { validateReview, type ReviewDecision, type ReviewRow } from "./review";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const literal = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** The same gate is used for preview and by the reviewed writer before any write. */
export async function validateReviewSource(row: ReviewRow, decision: ReviewDecision, today: string, read: typeof fetchPage = fetchPage) {
  validateReview(row, decision, today);
  if (decision.action !== "publish") throw Error("Publication requires a publish decision");
  const source = await read(row.source_url, { fresh: true });
  const evidence = row.evidence as { documentHash?: string; textHash?: string } | null;
  const event = row.payload as unknown as ParsedEvent;
  const text = pageAsText(source.html, row.source_url).text;
  const structured = event.evidence?.method === "structured_calendar";
  const sameDocument = evidence?.textHash && !structured ? hash(text) === evidence.textHash : Boolean(evidence?.documentHash && hash(source.html) === evidence.documentHash);
  if (source.status !== 200 || !sameDocument) throw Error(`Source changed or unavailable: ${row.id}; re-read and review`);
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
