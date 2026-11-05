/**
 * Is plain reading of an organiser's page right? Two checks it had no part in.
 *  1. A race whose next edition reached the catalogue another way: does the page give that date?
 *  2. A page plain reading accepted: does the model, asked separately, read the same date?
 * Reports only. The second check runs only with --max-ai and LOCAL_ALLOW_AI=1 (paid).
 *   ... audit-literal-editions.ts --archive=DIR --out=FILE [--max-ai=80]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parse } from "dotenv";

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const archive = arg("archive"), out = arg("out"), maxAi = Number(arg("max-ai") ?? 0);
if (!archive || !out) throw Error("Use --archive=DIR --out=FILE");
type Review = { id: string; name: string; website_url: string | null; candidatePages?: { url: string; title?: string }[] };
const hostOf = (url: string | null) => { try { return new URL(url ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } };

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const [{ createServerSupabase }, next, identity, { literalEditionAnswer }, { askJson, llmSpent, HAIKU }, { defaultEditionSeason }] = await Promise.all([
    import("../src/lib/supabase/server"), import("../src/lib/catalog/next-edition"), import("../src/lib/catalog/edition-identity"), import("../src/lib/catalog/next-edition-literal"), import("../src/lib/llm/anthropic"), import("../src/lib/catalog/edition-season"),
  ]);
  const season = defaultEditionSeason(), target = season + 1;
  const db = createServerSupabase();
  const read = async (from: string, until: string) => {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("events").select("id,name,start_date,end_date,visibility,series_id,disciplines,event_type,website_url,location:locations(lat,lng,municipality,country_code)").is("merged_into_id", null).gte("start_date", from).lt("start_date", until).order("id").range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  const previous = new Map((await read(`${season}-01-01`, `${target}-01-01`)).map(row => [row.id, row]));
  const upcoming = await read(`${target}-01-01`, `${target + 1}-01-01`);
  // Editions this reading created itself cannot vouch for it.
  const { data: own, error } = await db.from("event_sources").select("event_id").like("external_id", "next-edition:%");
  if (error) throw error;
  const self = new Set((own ?? []).map(row => row.event_id));
  const reviews = JSON.parse(readFileSync(join(archive!, "replay", "race-review.json"), "utf8")) as Review[];
  const pageText = (url: string) => { const file = join(archive!, "pages", `${createHash("sha256").update(url).digest("hex").slice(0, 20)}.txt`); return existsSync(file) ? readFileSync(file, "utf8") : ""; };
  const known = { agree: 0, near: 0, differ: [] as object[] }, model = { agree: 0, modelSaysNo: [] as object[], differ: [] as object[], asked: 0 };
  for (const review of reviews) {
    const race = previous.get(review.id);
    if (!race) continue;
    const candidate = { id: race.id, name: race.name, start_date: race.start_date, website_url: review.website_url, disciplines: race.disciplines, municipality: race.location?.municipality ?? null, country: race.location?.country_code ?? "", event_type: race.event_type };
    const edition = identity.findNextEdition({ id: race.id, name: race.name, start_date: race.start_date, series_id: race.series_id, disciplines: race.disciplines, location: race.location }, upcoming);
    for (const page of (review.candidatePages ?? []).filter(p => hostOf(p.url) === hostOf(review.website_url)).slice(0, 3)) {
      const text = pageText(page.url);
      if (!text) continue;
      const pageInput = { url: page.url, title: page.title, text: text.split("\n").slice(3).join("\n") };
      const literal = literalEditionAnswer({ race: { ...candidate, end_date: race.end_date }, page: pageInput, year: target, ownPage: page.url === review.website_url && new URL(page.url).pathname !== "/" });
      if (literal.state !== "answer") continue;
      const date = literal.answer.startDate as string;
      if (edition && !self.has(edition.id)) {
        if (edition.start_date === date) known.agree++;
        else if (Math.abs(Date.parse(edition.start_date) - Date.parse(date)) <= 2 * 86_400_000) known.near++;
        else known.differ.push({ race: race.name, page: page.url, read: date, catalogue: edition.start_date, quote: literal.answer.quote });
      }
      if (model.asked < maxAi) {
        model.asked++;
        const reply = (await askJson<{ announced?: boolean; sameRace?: boolean; startDate?: string; quote?: string }>({ ...next.editionPrompt(candidate, { ...pageInput, text }, target), model: HAIKU, maxTokens: 300 })).json;
        if (reply?.announced !== true || reply.sameRace !== true) model.modelSaysNo.push({ race: race.name, page: page.url, read: date, quote: literal.answer.quote, reply });
        else if (reply.startDate === date) model.agree++;
        else model.differ.push({ race: race.name, page: page.url, read: date, model: reply.startDate, quote: literal.answer.quote, modelQuote: reply.quote });
      }
      break;
    }
  }
  const summary = { at: new Date().toISOString(), againstCatalogue: known, againstModel: model, aiUsd: Number(llmSpent().toFixed(4)) };
  writeFileSync(out!, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ catalogue: { agree: known.agree, near: known.near, differ: known.differ.length }, model: { asked: model.asked, agree: model.agree, no: model.modelSaysNo.length, differ: model.differ.length }, aiUsd: summary.aiUsd }));
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
