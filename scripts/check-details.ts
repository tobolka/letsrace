/** The second reader on the Mac: checks details found here against their sources and records what may go out. */
import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "dotenv";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const gatePath = arg("gate")!, max = Number(arg("max") ?? 40), started = Date.now(), seconds = Number(arg("seconds") ?? 300);
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { readAllRows } = await import("../src/lib/supabase/read-all");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { checkDetails } = await import("../src/lib/catalog/detail-check");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const gate: Record<string, { at: string; fields: Record<string, { verdict: string; reason: string; value: string; wrong_items?: string[] }> }> = JSON.parse(await readFile(gatePath, "utf8").catch(() => "{}"));
  const races = await readAllRows((a, b) => db.from("events").select("id,name,start_date,end_date,practical_details,location:locations(municipality)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).neq("practical_details", "{}").order("start_date").range(a, b));
  const FRESH_DAYS = 14, now = Date.now();
  const facts = (race: (typeof races)[number]) => Object.fromEntries(Object.entries((race.practical_details ?? {}) as Record<string, { value: unknown; sourceUrl: string }>).filter(([field]) => field !== "documents"));
  const due = races.filter(race => {
    const entry = gate[race.id], current = facts(race);
    if (!entry) return Object.keys(current).length > 0;
    if (now - Date.parse(entry.at) > FRESH_DAYS * 86400000) return true;
    return Object.entries(current).some(([field, fact]) => entry.fields[field]?.value !== hash(fact.value));
  }).slice(0, max);
  const totals: Record<string, number> = {}; let cost = 0, checked = 0;
  const flagged: unknown[] = [];
  for (const race of due) {
    if (Date.now() - started > seconds * 1000) break;
    const current = facts(race);
    const urls = [...new Set(Object.values(current).flatMap(fact => [fact.sourceUrl, ...(Array.isArray(fact.value) ? (fact.value as { sourceUrl?: string }[]).map(item => item.sourceUrl).filter((url): url is string => Boolean(url)) : [])]))].slice(0, 4);
    const documents = (await Promise.all(urls.map(async url => { const doc = await readDocument(url, { maxBytes: 8388608 }).catch(() => null); return doc?.text?.trim() ? { url, text: doc.html ? pageAsText(doc.html, url).text : doc.text } : null; }))).filter((doc): doc is { url: string; text: string } => Boolean(doc));
    const fields: Record<string, { verdict: string; reason: string; value: string; wrong_items?: string[] }> = {};
    if (!documents.length) { for (const [field, fact] of Object.entries(current)) fields[field] = { verdict: "unreadable", reason: "source could not be read", value: hash(fact.value) }; }
    else {
      const { checks, costUsd } = await checkDetails({ name: race.name, start_date: race.start_date, end_date: race.end_date, municipality: race.location?.municipality }, current, documents);
      cost += costUsd;
      for (const [field, fact] of Object.entries(current)) { const check = checks.find(item => item.field === field); fields[field] = { verdict: check ? (check.verdict === "confirmed" && check.wrong_items.length ? "partly" : check.verdict) : "unsure", reason: check?.reason ?? "", value: hash(fact.value), ...(check?.wrong_items?.length ? { wrong_items: check.wrong_items } : {}) }; }
    }
    gate[race.id] = { at: new Date().toISOString(), fields };
    checked++;
    for (const [field, item] of Object.entries(fields)) { totals[item.verdict] = (totals[item.verdict] ?? 0) + 1; if (item.verdict !== "confirmed") flagged.push({ race: race.name, date: race.start_date, field, ...item }); }
    await writeFile(`${gatePath}.tmp`, JSON.stringify(gate)); await rename(`${gatePath}.tmp`, gatePath);
  }
  if (arg("out")) await writeFile(arg("out")!, JSON.stringify({ checked, totals, cost, flagged }, null, 1));
  console.log(`check_details ${JSON.stringify({ due: due.length, checked, totals, cost: Number(cost.toFixed(4)) })}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
