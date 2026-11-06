/**
 * Reading races by hand in a session, through the same checks as the automatic reader. Each race read
 * is kept as a tested example, with how its documents were found, so the reader can be measured on it.
 *
 *   read-race.ts fetch <url> [url...]      saves each document's text under --dir and prints its start and links
 *   read-race.ts apply <file.json>         checks and saves [{ id, how, links, documents, facts }]
 */
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parse } from "dotenv";

const dir = resolve(process.argv.find(arg => arg.startsWith("--dir="))?.slice(6) ?? "reports/pdf-extraction-2026-11-05/session-reading");
const keyOf = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 16);

async function reader() {
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  return async (url: string) => {
    const doc = await readDocument(url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null);
    if (!doc?.text?.trim()) return null;
    const source = doc.html ? pageAsText(doc.html, url) : { text: doc.text, links: new Set<string>() };
    return { url, text: source.text, links: [...source.links] };
  };
}

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value;
  mkdirSync(join(dir, "documents"), { recursive: true });
  const [command, ...rest] = process.argv.slice(2).filter(arg => !arg.startsWith("--dir="));
  const read = await reader();
  if (command === "fetch") {
    for (const url of rest) {
      const doc = await read(url);
      if (!doc) { console.log(`=== ${url}\nNEČITELNÉ`); continue; }
      writeFileSync(join(dir, "documents", `${keyOf(url)}.json`), JSON.stringify(doc));
      const useful = doc.links.filter(link => /\.pdf(?:$|\?)|propoz|pokyn|ausschreibung|regulamin|rozpis|registr|prihl|vysledk|kontakt/i.test(link)).slice(0, 25);
      console.log(`=== ${url}\nznaků ${doc.text.length} | ${keyOf(url)}\n${doc.text.slice(0, Number(process.env.READ_CHARS ?? 3500))}\n--- odkazy\n${useful.join("\n")}`);
    }
    return;
  }
  if (command !== "apply") throw Error("fetch or apply");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails, saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { documentLinks } = await import("../src/lib/catalog/race-completeness");
  const db = createServerSupabase();
  const entries = JSON.parse(readFileSync(rest[0]!, "utf8")) as { id: string; how: string; links?: { website?: string; regulations?: string; results?: string }; documents: string[]; facts: Record<string, unknown>; forceInstructions?: boolean }[];
  for (const entry of entries) {
    const { data: row } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,regulations_url,results_url,location:locations(venue,municipality)").eq("id", entry.id).maybeSingle();
    if (!row) { console.log(`${entry.id}: NENALEZENO`); continue; }
    const documents = [];
    for (const url of entry.documents) {
      let doc; try { doc = JSON.parse(readFileSync(join(dir, "documents", `${keyOf(url)}.json`), "utf8")); } catch { doc = await read(url); }
      if (doc) documents.push(doc);
    }
    const context = { name: row.name, startDate: row.start_date, endDate: row.end_date, knownVenue: row.location?.venue ?? undefined, municipality: row.location?.municipality ?? null, ownUrls: [...entry.documents, row.website_url, row.regulations_url], documents };
    const checked = verifyPracticalExtraction({ facts: entry.facts }, context);
    const links_: ReturnType<typeof documentLinks> = entry.forceInstructions ? entry.documents.map(url => ({ kind: "instructions" as const, url })) : documentLinks(documents, { name: row.name, start_date: row.start_date, municipality: row.location?.municipality, website_url: row.website_url });
    if (links_.length) { const first = documents.find(document => document.url === links_[0]!.url)!; (checked.details as Record<string, unknown>).documents = { value: links_, sourceUrl: first.url, quote: first.text.replace(/\s+/g, " ").trim().slice(0, 200), checkedAt: new Date().toISOString(), editionYear: Number(row.start_date.slice(0, 4)), status: "current" }; }
    const saved = process.argv.includes("--dry") ? { status: "dry" } : await savePracticalDetails(row.id, row.public_revision, checked.details);
    const links = process.argv.includes("--dry") ? 0 : await saveFoundLinks(row, entry.links ?? {});
    const line = { id: row.id, name: row.name, start_date: row.start_date, how: entry.how, documents: entry.documents, expected: Object.fromEntries(Object.entries(checked.details).map(([field, fact]) => [field, (fact as { value: unknown }).value])), links: entry.links, refused: checked.reasons };
    if (!process.argv.includes("--dry")) appendFileSync(join(dir, "golden.jsonl"), `${JSON.stringify(line)}\n`);
    console.log(`${row.name.slice(0, 44)}: přijato ${Object.keys(checked.details).join(",") || "-"} | odmítnuto ${JSON.stringify(checked.reasons)} | ${JSON.stringify(saved).slice(0, 90)} | odkazy ${links}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
