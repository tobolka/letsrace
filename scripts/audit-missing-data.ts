/**
 * Why do we hold nothing for a race? Takes a random sample of last season's races with no next
 * edition found and looks at what their pages really offer: PDFs, posters, Facebook.
 * Reports only. Start through scripts/local-run.sh:
 *   ... audit-missing-data.ts --archive=DIR --size=200 --seed=N --out=FILE
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { fetchPage } from "../src/lib/watcher/http";
import { mapPool } from "../src/lib/watcher/pool";

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const archive = arg("archive"), out = arg("out"), size = Number(arg("size") ?? 200);
let seed = Number(arg("seed") ?? 1);
if (!archive || !out) throw Error("Use --archive=DIR --out=FILE");
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const NEXT = /2027/;
const REGULATIONS = /propozic|rozpis|ausschreibung|regulamin|regolamento|regulament|pokyny|bulletin|reglement/i;
const POSTER = /plak[aá]t|poster|flyer|leaflet|volantino|locandina|ulotk|program/i;

type Review = { id: string; name: string; website_url: string | null; reviewStatus: string; location?: { country_code?: string | null } | null };
async function main() {
  const reviews = JSON.parse(readFileSync(join(archive!, "replay", "race-review.json"), "utf8")) as Review[];
  const groups = ["no_date_signal_detected", "year_mentioned_without_full_date"];
  const pool = reviews.filter(r => r.website_url && groups.includes(r.reviewStatus)).map(race => ({ race, rank: random() })).sort((a, b) => a.rank - b.rank).slice(0, size).map(item => item.race);
  const rows = await mapPool(pool, 8, async race => {
    const base = { name: race.name, status: race.reviewStatus, country: race.location?.country_code, url: race.website_url };
    try {
      const page = await fetchPage(race.website_url!, { timeoutMs: 20_000, retries: 0, fresh: true });
      if (page.status >= 400) return { ...base, http: page.status };
      const $ = cheerio.load(page.html);
      const links = $("a[href]").toArray().map(a => ({ href: $(a).attr("href") ?? "", label: $(a).text().replace(/\s+/g, " ").trim() }));
      const pdf = links.filter(l => /\.pdf(?:$|[?#])/i.test(l.href));
      const images = $("img[src]").toArray().map(i => ({ src: $(i).attr("src") ?? "", alt: $(i).attr("alt") ?? "" }));
      const words = $("body").text().replace(/\s+/g, " ").length;
      return {
        ...base, words,
        pdfs: pdf.length,
        pdfNext: pdf.filter(l => NEXT.test(`${l.href} ${l.label}`)).map(l => l.href).slice(0, 3),
        pdfRegulations: pdf.filter(l => REGULATIONS.test(`${l.href} ${l.label}`)).map(l => l.href).slice(0, 3),
        regulationsPage: links.filter(l => !/\.pdf/i.test(l.href) && REGULATIONS.test(`${l.href} ${l.label}`)).length,
        imagesNext: images.filter(i => NEXT.test(`${i.src} ${i.alt}`)).map(i => i.src).slice(0, 3),
        posters: images.filter(i => POSTER.test(`${i.src} ${i.alt}`)).map(i => i.src).slice(0, 3),
        images: images.length,
        facebook: [...new Set(links.map(l => l.href).filter(h => /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)/i.test(h)))].slice(0, 2),
        instagram: links.some(l => /instagram\.com\//i.test(l.href)),
      };
    } catch (failure) { return { ...base, failed: failure instanceof Error ? failure.message.slice(0, 50) : "" }; }
  });
  writeFileSync(out!, JSON.stringify(rows, null, 1));
  console.log(rows.length);
  process.exit(0);
}
main().catch(failure => { console.error(failure); process.exit(1); });
