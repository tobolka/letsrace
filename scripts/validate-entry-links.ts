/** Saved fixed cohort → current pages → literal proofs → independent audit → verified additive writes. */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { readDocument, type ReadDoc } from "../src/lib/catalog/regulation-ages";
import { readEntryProofs, auditEntryProofs, entryDocumentLinks, verifyEntryProofs, type EntryProof } from "../src/lib/catalog/entry-link-evidence";
import { textHash, recordFacts } from "../src/lib/catalog/facts";
import { llmSpent, LlmUnavailable } from "../src/lib/llm/anthropic";
import { isAccountOrNewsletterUrl, isStartListUrl } from "../src/lib/watcher/registration-url";
import { mapPool } from "../src/lib/watcher/pool";
import type { Update } from "../src/lib/supabase/tables";
config({ path: ".env.local", quiet: true });
process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
process.env.LLM_DAILY_BUDGET_USD ??= "2.50";
process.env.LLM_MONTHLY_BUDGET_USD ??= "25";
process.env.LLM_BUDGET_USD ??= "0.40";
const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith("--" + name + "="))?.slice(name.length + 3) ?? fallback;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const end = new Date(Date.parse(today + "T12:00:00Z") + 30 * 864e5).toISOString().slice(0, 10);
const version = "entry-links-v1";
type Race = { id: string; name: string; start_date: string; registration_url: string | null; regulations_url: string | null; website_url: string | null;
  location: { country_code: string; municipality: string | null }; sources: { source_url: string }[]; overrides: { locked_fields: string[] | null } | null };
type Reviewed = { race: Race; docs: ReadDoc[]; proofs: EntryProof[]; audit?: { accepted: EntryProof[]; reason: string; usage: unknown }; readUsage?: unknown; verdict?: unknown; error?: string };
type Plan = { version: string; createdAt: string; baseline: Race[]; reviewed: Reviewed[]; spentUsd: number; stopped: boolean };
const normal = (s: string) => s.replace(/\s+/g, " ").trim();
const locks = (r: Race, field: string) => r.overrides?.locked_fields?.includes(field);
async function baseline() {
  const rows: Race[] = [];
  const s = createServerSupabase();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("events").select("id,name,start_date,registration_url,regulations_url,website_url,location:locations!inner(country_code,municipality),sources:event_sources(source_url),overrides:event_overrides(locked_fields)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "confirmed", "tbc"]).gte("start_date", today).lte("start_date", end)
      .in("location.country_code", (process.env.CATALOG_COUNTRIES ?? "CZ,SK,AT,DE,PL,CH").split(",")).order("start_date").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data as unknown as Race[]);
    if (data.length < 1000) return rows;
  }
}
async function main() {
  mkdirSync("tmp/entry-validation", { recursive: true });
  const applyPath = arg("apply-plan", "");
  const path = applyPath || arg("out", "tmp/entry-validation/plan-" + today + ".json");
  const before = await baseline();
  const s = createServerSupabase();
  if (applyPath) {
    const plan = JSON.parse(readFileSync(path, "utf8")) as Plan;
    if (plan.version !== version) throw new Error("Wrong plan version");
    const writes: unknown[] = [], skipped: unknown[] = [];
    for (const reviewed of plan.reviewed) {
      const now = before.find(r => r.id === reviewed.race.id);
      if (!now || now.name !== reviewed.race.name || now.start_date !== reviewed.race.start_date) continue;
      const accepted = reviewed.audit?.accepted ?? [];
      if (!accepted.length) continue;
      const fresh: ReadDoc[] = [];
      for (const old of reviewed.docs) {
        const doc = await readDocument(old.url, { maxBytes: 16 * 1024 * 1024 }).catch(() => null);
        if (doc && textHash(normal(doc.text)) === textHash(normal(old.text))) fresh.push(doc);
      }
      const stillValid = verifyEntryProofs(now, fresh, { links: accepted });
      for (const p of accepted) {
        if (!stillValid.some(v => v.field === p.field && v.url === p.url) || !fresh.some(d => d.url === p.url) || now[p.field] || locks(now, p.field)) {
          skipped.push({ id: now.id, field: p.field, reason: "changed source, occupied field, human lock or unreadable target" }); continue;
        }
        const { data: current, error: check } = await s.from("events").select("name,start_date,overrides:event_overrides(locked_fields)").eq("id", now.id).eq("visibility", "public").is("merged_into_id", null).single();
        if (check || !current || current.name !== now.name || current.start_date !== now.start_date || (current.overrides as unknown as Race["overrides"])?.locked_fields?.includes(p.field)) continue;
        const { data: changed, error } = await s.from("events").update({ [p.field]: p.url, updated_at: new Date().toISOString() } as Update<"events">)
          .eq("id", now.id).is(p.field, null).select("id," + p.field);
        if (error) throw error;
        if (!changed?.length) continue;
        try {
          await recordFacts(s, now.id, [{ field: p.field, value: p.url, previous: null, sourceUrl: p.sourceUrl, quote: [p.nameQuote, p.dateQuote, p.linkQuote].join("\n") }], { method: "entry_link_evidence", model: "claude-haiku-5-5 + claude-sonnet-5-5", version });
        } catch (error) {
          const { error: cleanup } = await s.from("events").update({ [p.field]: null } as Update<"events">).eq("id", now.id).eq(p.field, p.url);
          if (cleanup) throw cleanup;
          throw error;
        }
        const { data: saved, error: readError } = await s.from("events").select(p.field).eq("id", now.id).single();
        if (readError || (saved as unknown as Record<string, unknown>)[p.field] !== p.url) throw new Error("Readback failed");
        writes.push({ id: now.id, name: now.name, ...p }); console.log("VERIFIED " + now.name + " " + p.field + " → " + p.url);
        writeFileSync(path.replace(/\.json$/, "-applied.json"), JSON.stringify({ writes, skipped }, null, 2));
      }
    }
    const after = await baseline();
    const matched = after.filter(r => plan.baseline.some(b => b.id === r.id));
    const delta = (field: "registration_url" | "regulations_url") => matched.filter(r => !plan.baseline.find(b => b.id === r.id)![field] && r[field]).length;
    const result = { cohort: matched.length, writes, skipped, registrationAdded: delta("registration_url"), regulationsAdded: delta("regulations_url") };
    writeFileSync(path.replace(/\.json$/, "-applied.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); return;
  }
  const auditPath = arg("audit-plan", "");
  if (auditPath) {
    const plan = JSON.parse(readFileSync(auditPath, "utf8")) as Plan;
    if (plan.version !== version) throw new Error("Wrong plan version");
    const initialCost = plan.spentUsd;
    for (const row of plan.reviewed) {
      row.proofs = verifyEntryProofs({ ...row.race, municipality: row.race.location.municipality }, row.docs, { links: row.proofs });
      for (const p of row.proofs) if (!row.docs.some(d => d.url === p.url)) {
        const doc = await readDocument(p.url, { maxBytes: 16 * 1024 * 1024 }).catch(() => null); if (doc) row.docs.push(doc);
      }
      row.audit = await auditEntryProofs(row.race, row.proofs, row.docs);
      console.log("AUDITED " + row.race.name + ": " + row.audit.accepted.length + " / " + row.proofs.length);
      plan.spentUsd = initialCost + llmSpent(); writeFileSync(path, JSON.stringify(plan, null, 2));
    }
    return;
  }
  const rereadPath = arg("reread-plan", "");
  const max = Number(arg("max", "20"));
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error("Use --max=1..100");
  const excludePath = arg("exclude-plan", "");
  const exclude = new Set(excludePath ? (JSON.parse(readFileSync(excludePath, "utf8")) as Plan).reviewed.map(r => r.race.id) : []);
  const targets = before.filter(r => !exclude.has(r.id) && ((!r.registration_url && !locks(r, "registration_url")) || (!r.regulations_url && !locks(r, "regulations_url")))
    && (r.website_url || r.sources.length)).slice(0, max);
  const plan: Plan = { version, createdAt: new Date().toISOString(), baseline: before, reviewed: [], spentUsd: 0, stopped: false };
  const save = () => { plan.spentUsd = llmSpent(); writeFileSync(path, JSON.stringify(plan, null, 2)); };
  save();
  const reads = new Map<string, Promise<ReadDoc | null>>();
  const read = (url: string) => { if (!reads.has(url)) reads.set(url, readDocument(url).catch(() => null)); return reads.get(url)!; };
  const reread = rereadPath ? JSON.parse(readFileSync(rereadPath, "utf8")) as Plan : null;
  if (reread && reread.version !== version) throw new Error("Wrong plan version");
  if (reread) plan.baseline = reread.baseline;
  const names = arg("names", "").split(",").filter(Boolean);
  const collected = reread ? reread.reviewed.filter(r => !names.length || names.some(n => r.race.name.includes(n))).map(r => ({ race: r.race, docs: r.docs, proofs: [] } as Reviewed)) : await mapPool(targets, 3, async race => {
    const seeds = [...new Set([race.website_url, race.registration_url, ...race.sources.map(s => s.source_url)].filter((u): u is string => Boolean(u)))].slice(0, 4);
    const docs = (await Promise.all(seeds.map(read))).filter((d): d is ReadDoc => Boolean(d));
    // Follow actual action links only; shared calendars must prove the selected round in the audit.
    const children = [...new Set(docs.flatMap(entryDocumentLinks).filter(l => !isAccountOrNewsletterUrl(l.url) && !isStartListUrl(l.url) && /regul|propoz|ausschreib|rozpis|anmeld|registr|zapisy|p[řr]ihl[aá]|\.pdf/i.test(l.text + " " + l.url)).map(l => l.url))].filter(u => !seeds.includes(u)).slice(0, 3);
    const related = (await Promise.all(children.map(read))).filter((d): d is ReadDoc => Boolean(d));
    console.log("COLLECTED " + race.name + ": " + (docs.length + related.length) + " documents");
    return { race, docs: [...docs, ...related], proofs: [] } as Reviewed;
  });
  for (const row of collected) {
    try {
      const got = await readEntryProofs({ ...row.race, municipality: row.race.location.municipality }, row.docs);
      row.proofs = got.proofs.filter(p => !row.race[p.field] && !locks(row.race, p.field));
      row.readUsage = got.usage;
      row.verdict = got.verdict;
      // Fetch proposed destinations before the independent reviewer sees them.
      for (const p of row.proofs) if (!row.docs.some(d => d.url === p.url)) { const doc = await read(p.url); if (doc) row.docs.push(doc); }
      if (row.proofs.length) row.audit = await auditEntryProofs(row.race, row.proofs, row.docs);
      console.log("REVIEWED " + row.race.name + ": proposed=" + row.proofs.length + " accepted=" + (row.audit?.accepted.length ?? 0));
      plan.reviewed.push(row);
    } catch (error) {
      if (error instanceof LlmUnavailable) { plan.stopped = true; save(); break; }
      row.error = String(error); plan.reviewed.push(row);
    } finally { save(); }
  }
  console.log({ cohort: before.length, targets: collected.length, reviewed: plan.reviewed.length, proposals: plan.reviewed.reduce((n, r) => n + r.proofs.length, 0), accepted: plan.reviewed.reduce((n, r) => n + (r.audit?.accepted.length ?? 0), 0), spentUsd: llmSpent(), stopped: plan.stopped });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
