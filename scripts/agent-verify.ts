/**
 * Check the agent's answers against the pages themselves: fetch each address again and look
 * for the quote on it, word for word (case, accents and spacing aside). An answer whose quote
 * is not where it says is marked unverified and goes nowhere. Reads websites only; no keys.
 *
 *   tsx scripts/agent-verify.ts --answers=<dir> [--cases=<dir>]
 *
 * Writes <answers>/verified.json. A quote being on the page does not prove the answer right
 * (the page may be about another race); it proves the agent did not make the words up.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDocument } from "../src/lib/catalog/regulation-ages";
import { quoteStatesDate } from "../src/lib/catalog/quoted-date";

const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
export const folded = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const quoteIsOn = (page: string, quote: string) => { const q = folded(quote); return q.length >= 6 && folded(page).includes(q); };

async function main() {
  const answers = arg("answers"); if (!answers) throw Error("--answers=<dir> is needed");
  const pages = new Map<string, string>();
  const page = async (url: string) => {
    if (!pages.has(url)) pages.set(url, (await readDocument(url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null))?.text ?? "");
    return pages.get(url)!;
  };
  const rows: object[] = [];
  for (const file of readdirSync(answers).filter(name => /^[a-z]+-[0-9a-f]{8}\.json$/.test(name)).sort()) {
    const saved = JSON.parse(readFileSync(join(answers, file), "utf8"));
    const answer = saved.answer;
    if (!answer) { rows.push({ case: saved.case, verdict: null, verified: false, why: `refused: ${saved.refused}` }); continue; }
    if (saved.kind === "find_races") {
      // Each race stands on its own quote: found on its page, and stating that race's full date.
      const kept: number[] = [], checks = [];
      for (const [index, race] of (answer.races ?? []).entries()) {
        const text = await page(race.url); const quoteFound = quoteIsOn(text, race.quote), statesDate = quoteStatesDate(race.quote, race.start_date);
        checks.push({ url: race.url, read: text.length > 0, quoteFound, statesDate });
        if (quoteFound && statesDate) kept.push(index);
      }
      rows.push({ case: saved.case, kind: saved.kind, verdict: answer.verdict, verified: answer.verdict === "found" ? kept.length > 0 : null, verifiedRaces: kept, checks });
      continue;
    }
    const single = saved.kind === "find_regulations" ? answer.verdict === "found" : saved.kind === "find_next_date" ? answer.verdict === "announced" : false;
    const evidence: { url: string; quote: string }[] = single ? [{ url: answer.url, quote: answer.quote }] : answer.evidence ?? [];
    const checks = [];
    for (const item of evidence) { const text = await page(item.url); checks.push({ url: item.url, read: text.length > 0, quoteFound: quoteIsOn(text, item.quote) }); }
    const decided = ["find_regulations", "find_next_date"].includes(saved.kind) ? single : answer.verdict !== "unsure";
    // A date is taken only from words that state it in full; the quote being on the page is not enough.
    const datesStated = saved.kind !== "find_next_date" || !single || quoteStatesDate(answer.quote, answer.start_date);
    rows.push({ case: saved.case, kind: saved.kind, verdict: answer.verdict, verified: decided ? checks.length > 0 && checks.every(check => check.quoteFound) && datesStated : null, ...(datesStated ? {} : { why: "the quote does not state the date" }), checks, seconds: saved.seconds, usd: saved.usd });
  }
  writeFileSync(join(answers, "verified.json"), JSON.stringify(rows, null, 1));
  for (const row of rows as { case: string; verdict: string; verified: boolean | null; checks?: { url: string; read: boolean; quoteFound: boolean }[] }[]) {
    console.log(`${row.verified === true ? "OVĚŘENO " : row.verified === false ? "NEOVĚŘENO" : "bez nálezu"} ${row.case} ${row.verdict} ${(row.checks ?? []).map(check => `${check.quoteFound ? "✓" : check.read ? "✗ citace" : "✗ nečitelné"} ${check.url}`).join(" | ")}`);
  }
}
if (process.argv.some(value => value.startsWith("--answers="))) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
