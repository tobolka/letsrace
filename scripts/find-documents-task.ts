/**
 * One queue task, read without any of our keys: look on one site for the regulations of the
 * races it was given. Input and output are files; this process is started with an environment
 * built for it (scripts/pipeline2-find-documents.ts) and never loads .env.local.
 *
 *   tsx scripts/find-documents-task.ts --task=<in.json> --out=<out.json>
 *
 * It decides nothing. It hands back proposals with the page and the words on it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { readDocument } from "../src/lib/catalog/regulation-ages";
import { documentIsAboutRace } from "../src/lib/catalog/race-completeness";
import { regulationsCandidates, siteDocuments } from "../src/lib/catalog/site-documents";

export const READER = "site_documents", VERSION = "2";
type Race = { id: string; name: string; start_date: string; website_url: string; municipality?: string | null };
type Task = { site: string; races: Race[]; seconds?: number };

const ROBOT_CHECK = /just a moment|cf-chl|challenge-platform|anubis|verify (?:that )?you are (?:a )?human|are you a robot|captcha/i;

/** Is the site there at all? "No documents" from a site that never answered would be a lie. */
async function door(site: string): Promise<{ outcome: "failed" | "blocked"; reason: "http_error" | "robot_check" | "sign_in" } | null> {
  const response = await fetch(site, { headers: { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)", accept: "*/*" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!response) return { outcome: "failed", reason: "http_error" };
  if ([401, 403, 429, 503].includes(response.status)) {
    const body = await response.text().catch(() => "");
    if (ROBOT_CHECK.test(body.slice(0, 20_000))) return { outcome: "blocked", reason: "robot_check" };
    if (response.status === 401) return { outcome: "blocked", reason: "sign_in" };
    return { outcome: "failed", reason: "http_error" };
  }
  if (response.status >= 500) return { outcome: "failed", reason: "http_error" };
  return null;
}

async function main() {
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const task = JSON.parse(await readFile(arg("task")!, "utf8")) as Task;
  const deadline = Date.now() + (task.seconds ?? 200) * 1000;
  const stats = { races: task.races.length, documents: 0, read: 0, found: 0 };
  const done = (result: object) => writeFile(arg("out")!, JSON.stringify({ ...result, stats }));

  const shut = await door(task.site);
  if (shut) return done({ ...shut, proposals: [] });
  const documents = await siteDocuments(task.site, [...new Set(task.races.map(race => race.website_url))]);
  stats.documents = documents.length;
  const texts = new Map<string, string>();
  const proposals: object[] = [];
  let cut = false;
  for (const race of task.races) {
    for (const url of regulationsCandidates(documents, race)) {
      if (Date.now() > deadline) { cut = true; break; }
      if (!texts.has(url)) { const doc = await readDocument(url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null); stats.read++; texts.set(url, doc?.text ?? ""); }
      const text = texts.get(url)!;
      if (!documentIsAboutRace(text, { name: race.name, start_date: race.start_date, municipality: race.municipality })) continue;
      proposals.push({ event_id: race.id, field: "regulations_url", value: url, source_url: url, quote: text.replace(/\s+/g, " ").trim().slice(0, 300).padEnd(8, "."), reader: READER, version: VERSION });
      stats.found++;
      break;
    }
    if (cut) break;
  }
  if (cut) return done({ outcome: "partial", reason: "partial", proposals });
  if (!proposals.length) return done({ outcome: "waiting", reason: "no_document_yet", proposals });
  return done({ outcome: "done", reason: null, proposals });
}

if (process.argv.some(value => value.startsWith("--task="))) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
