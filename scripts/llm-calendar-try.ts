/**
 * Read one calendar page with the language model and, where an adapter knows
 * the page, compare: races both found, races only one of them found.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/llm-calendar-try.ts <url> [<url>…]
 * Read-only; prints cost.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fetchPage } = await import("../src/lib/watcher/http");
  const { extractEvents } = await import("../src/lib/watcher/core");
  const { extractWithLlm } = await import("../src/lib/watcher/extractors/llm-calendar");
  const today = new Date().toISOString().slice(0, 10);
  let cost = 0;
  for (const url of process.argv.slice(2).filter((a) => /^https?:/.test(a))) {
    const page = await fetchPage(url, { timeoutMs: 30_000 });
    const html = (page as { html?: string }).html ?? "";
    const old = await extractEvents(url, html).catch(() => ({ events: [], strategy: "error" }));
    const oldUp = old.events.filter((e) => (e.endDate ?? e.startDate) >= today);
    const llm = await extractWithLlm(url, html);
    cost += llm.usage.costUsd;
    const key = (e: { name: string; startDate: string }) => `${e.startDate}`;
    const oldDates = new Map(oldUp.map((e) => [key(e), e.name]));
    const llmDates = new Map(llm.events.map((e) => [key(e), e.name]));
    console.log(`\n=== ${url}\nparser (${old.strategy}): ${oldUp.length} upcoming   model: ${llm.events.length}  ($${llm.usage.costUsd.toFixed(3)}${llm.truncated ? ", page cut" : ""})`);
    for (const e of llm.events.slice(0, 60)) {
      const flag = oldDates.has(key(e)) ? "  both " : "  NEW  ";
      console.log(`${flag}${e.startDate}  ${e.name}  | ${e.placeText} ${e.countryHint ?? ""} | ${(e.discipline ?? []).join(",")} ${e.ageCategories ? `| ${e.ageCategories.join(",")}` : ""}${e.websiteUrl ? ` | ${e.websiteUrl}` : ""}`);
    }
    for (const e of oldUp) if (!llmDates.has(key(e))) console.log(`  MISSED ${e.startDate}  ${e.name}`);
  }
  console.log(`\ntotal $${cost.toFixed(3)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
