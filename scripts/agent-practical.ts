/** Re-read Codex evidence on the Mac. Extraction fills the local copy. A separate
 * check of the stored value is needed before the existing fills gate exports it. */
import { uncertainty } from "./agent-followup.cjs";
import { createHash } from "node:crypto";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "dotenv";
import { verifyPracticalExtraction, isOwnDocument, isSeriesDocumentOfRound, type PracticalDocument } from "../src/lib/catalog/practical-extraction";
import { savePracticalDetails } from "../src/lib/catalog/practical-enrichment";
import { readDocument } from "../src/lib/catalog/regulation-ages";
import { createServerSupabase } from "../src/lib/supabase/server";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";

const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
const metadata = new Set(["sourceUrl", "sourceQuote", "checkedAt", "sourceLines"]);
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !metadata.has(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key, entry]) => [key, comparable(entry)]));
}

type Fact = { value: object; source_url: string; quote: string; identity_quote: string; edition_quote: string; status: string };
type Saved = { at:string; case: string; kind: "extract_details" | "verify_details"; answer: { race: string; verdict: string; reason?: string; note?: string; facts: Record<string, Fact>;
  context: { date: string; end: string | null; urls: string[]; field?: string; storedHash?: string; storedFactHash?: string } } };
type Gate = Record<string, { at: string; fields: Record<string, { verdict: string; reason: string; value: string; at?: string }> }>;
async function readJson<T>(file: string, empty: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty; throw error; }
}
async function replaceJson(file: string, value: unknown) {
  const temp = file + "." + process.pid + ".tmp";
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}

async function main() {
  const dir = arg("answers"), gatePath = arg("gate");
  if (!dir || !gatePath) throw new Error("--answers and --gate are required");
  if (!/^http:\/\/127\.0\.0\.1:54331(?:\/|$)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Agent practical details must run against the Mac catalogue");
  for (const [key,value] of Object.entries(parse(await readFile(".env.local","utf8")))) process.env[key] ??= value;
  const files = await readdir(dir).catch(error => { if (error.code === "ENOENT") return []; throw error; });
  const journal = join(dir, "practical-reviewed.json");
  const done = await readJson<Record<string,unknown>>(journal,{});
  const ocrPath = join(dir, "ocr.json");
  const ocr = await readJson<Record<string, { answerAt: string; at: string; changed?: boolean; documents: { url: string; text: string }[] }>>(ocrPath, {});
  const db = createServerSupabase();
  let processed = 0, retry = 0;
  const deadline = Date.now() + 5 * 60_000;
  for (const file of files.filter(file => /^(?:details|detailcheck)-[a-f0-9]{8}\.json$/.test(file)).sort()) {
    if (processed + retry >= 20 || Date.now() >= deadline) break;
    const saved = await readJson<Saved | null>(join(dir,file),null);
    if (!saved || !["extract_details","verify_details"].includes(saved.kind)) continue;
    const journalKey = file + ":" + saved.at;
    if (done[journalKey]) continue;
    const { answer } = saved;
    const record = async (outcome: string, detail?: unknown) => {
      done[journalKey] = { at:new Date().toISOString(), outcome, detail };
      await replaceJson(journal, done);
      processed++;
    };
    if (answer.verdict !== "found") {
      const reason = uncertainty(answer);
      if (reason === "scanned_document" && ocr[saved.case]?.answerAt !== saved.at) {
        const body = await readJson<{ urls?: string[] } | null>(join(dir, "..", "cases", file), null);
        const documents = [];
        for (const url of (body?.urls ?? []).filter(url => /\.(pdf|zip)(?:[?#]|$)/i.test(url)).slice(0, 3)) {
          const source = await readDocument(url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null);
          if (!source?.html && source?.text.trim()) documents.push({ url, text: source.text.slice(0, 16_000) });
        }
        const changed = JSON.stringify(documents) !== JSON.stringify(ocr[saved.case]?.documents);
        ocr[saved.case] = { answerAt: saved.at, at: new Date().toISOString(), documents, changed };
        await replaceJson(ocrPath, ocr);
      }
      await record("unsure", { reason });
      continue;
    }
    const { context: asked } = answer;
    const { data: race,error } = await db.from("events").select("id,name,status,start_date,end_date,regulations_url,website_url,practical_details,public_revision,location:locations(venue,municipality)").eq("id",answer.race).eq("visibility","public").is("merged_into_id",null).maybeSingle();
    if (error) throw new Error(error.message);
    if (!race || ["cancelled","completed"].includes(race.status ?? "") || race.start_date !== asked.date || race.end_date !== asked.end) { await record("race_changed"); continue; }
    const stored = (race.practical_details ?? {}) as Record<string,{value:unknown;sourceUrl:string}>;
    const current = asked.field ? stored[asked.field] : undefined;
    const eligible = asked.field ? [current?.sourceUrl] : [race.regulations_url,race.website_url];
    if (asked.field && (!current || asked.storedFactHash !== hash(current))) { await record("value_changed"); continue; }
    const facts = Object.fromEntries(Object.entries(answer.facts).filter(([field,fact]) =>
      (asked.field ? field === asked.field : !stored[field]) && eligible.includes(fact.source_url) && asked.urls.includes(fact.source_url)));
    if (!Object.keys(facts).length) { await record("no_current_fields"); continue; }
    const documents: PracticalDocument[] = [];
    let unreadable = false;
    for (const url of new Set(Object.values(facts).map(fact=>fact.source_url))) {
      const source = await readDocument(url,{maxBytes:8*1024*1024}).catch(()=>null);
      const content = source?.html ? pageAsText(source.html,url) : {text:source?.text ?? "",links:[]};
      if (content.text.trim()) documents.push({url,text:content.text,links:[...content.links]});
      else unreadable = true;
    }
    if (unreadable) { retry++; continue; }
    for (const [field,fact] of Object.entries(facts)) {
      // The verifier uses the field quote and each list row's verbatim quote.
      if (Array.isArray(fact.value)) facts[field] = {...fact,value:fact.value.map(item=>{
        if (!item || typeof item !== "object") return item;
        const {quote,...data} = item;
        return {...data,sourceUrl:fact.source_url,sourceQuote:quote};
      })};
    }
    const evidenceContext = {name:race.name,startDate:race.start_date,endDate:race.end_date,knownVenue:race.location?.venue ?? undefined,municipality:race.location?.municipality,ownUrls:[race.website_url,race.regulations_url],documents};
    // Limit evidence to attributable documents. Quotes are still checked per field.
    evidenceContext.documents = documents.filter(doc=>isOwnDocument(doc,evidenceContext)||isSeriesDocumentOfRound(doc,evidenceContext));
    const checked = verifyPracticalExtraction({facts},evidenceContext);
    if (asked.field && current) {
      const supported = (checked.details as Record<string,{value:unknown}>)[asked.field];
      if (!supported) { await record("evidence_rejected",checked.reasons); continue; }
      const confirmed = JSON.stringify(comparable(supported.value)) === JSON.stringify(comparable(current.value));
      const gate = await readJson<Gate>(gatePath,{});
      const now = new Date().toISOString();
      const fields = {...gate[race.id]?.fields,[asked.field]:{value:hash(current.value),at:now,verdict:confirmed?"confirmed":"unsure",reason:confirmed?"Codex evidence re-read by Mac":"Verified source differs; inspect the proposed value before any correction"}};
      gate[race.id] = {at:gate[race.id]?.at ?? now,fields};
      await replaceJson(gatePath,gate);
      await record(confirmed?"confirmed":"needs_review",confirmed?undefined:{field:asked.field,stored:current.value,supported:supported.value,source:facts[asked.field]?.source_url});
    } else if (Object.keys(checked.details).length) {
      const result = await savePracticalDetails(race.id,race.public_revision,checked.details);
      if (result.status === "changed") { retry++; continue; }
      const fields = Object.fromEntries((result.changed ?? []).map(field => [
        field, (checked.details as Record<string, { value: unknown }>)[field]?.value,
      ]));
      await record(result.status, { race: race.id, fields, skipped: result.skipped, rejected: checked.reasons });
    } else await record("evidence_rejected",checked.reasons);
  }
  if (processed || retry) console.log("agent_practical " + JSON.stringify({processed,retry}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
