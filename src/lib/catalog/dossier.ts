import * as cheerio from "cheerio";
import { directDocumentUrl, readDocument } from "@/lib/catalog/regulation-ages";
import { textNamesEdition } from "@/lib/date-in-text";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";

/**
 * Everything written about one race, gathered before anyone reads it:
 * its site, its entry page, its regulations (PDF too), the pages its site
 * links as categories, rules or entry, and the aggregator pages that listed it.
 *
 * Each document is tied to this edition by the one thing every organiser
 * writes — the date. A page that names the race's day (and not only another
 * year) is this edition's; one that does not is kept only as background.
 */
export type DossierDoc = {
  url: string;
  kind: "site" | "registration" | "regulations" | "linked" | "listing";
  text: string;
  /** Names this race's day, and not only another year. */
  thisEdition: boolean;
  /** Lines that look like a class list: U13, Jg. 2012, "Elite", "Kategorie". */
  classLines: number;
  thin: boolean;
};

const CLASS_LINE =
  /\bU\s?-?\d{1,2}\b|\bjg\.?\s*\d|\b(19|20)\d\d\s*[-–/]\s*(19|20)?\d\d\b|kategori|categor|klasse|klasy|ro[čc]n[ií]k|rocznik|junior|master|elit[ea]\b|kadet|[žz][aá]c|[žz][aá]k|senior|hobby|amat|open|giovanissimi|esordienti|allievi|nieuwelingen|aspiranten|benjamin|minime|cadet/i;

const FOLLOW = /propoz|regulation|reglement|regulamin|regolamento|ausschreibung|rozpis|bulletin|kategori|categor|klassen|klasy|registr|anmeld|p[řr]ihl|zapis|iscri|inscri|entry|startgeld|startovn|info|\.pdf/i;
const SKIP = /facebook|instagram|youtube|twitter|strava|komoot|maps\.google|mailto:|tel:|\.(jpg|png|gif|zip)(\?|$)/i;

export function classLineCount(text: string): number {
  return text.split(/\n+/).filter((l) => l.length < 200 && CLASS_LINE.test(l)).length;
}

function linksOf(html: string, base: string): { url: string; label: string }[] {
  const $ = cheerio.load(html);
  const out: { url: string; label: string }[] = [];
  $("a[href]").each((_, a) => {
    const raw = ($(a).attr("href") || "").trim();
    if (!raw || SKIP.test(raw)) return;
    try {
      out.push({ url: new URL(raw, base).toString().replace(/#.*$/, ""), label: $(a).text().replace(/\s+/g, " ").trim() });
    } catch {
      /* ignore */
    }
  });
  return out;
}

export async function gatherDossier(race: {
  startDate: string;
  website: string | null;
  registration: string | null;
  regulations: string | null;
  sources: string[];
  /** Render pages that are a script shell (needs Chrome on this machine). */
  render?: boolean;
  maxDocs?: number;
  /** Follow shared rules through an intermediate series information page. */
  seriesName?: string;
}): Promise<DossierDoc[]> {
  const max = race.maxDocs ?? 8;
  const queue: { url: string; kind: DossierDoc["kind"] }[] = [];
  const add = (url: string | null | undefined, kind: DossierDoc["kind"]) => {
    if (!url || SKIP.test(url)) return;
    const u = directDocumentUrl(url);
    if (!queue.some((q) => q.url === u)) queue.push({ url: u, kind });
  };
  add(race.website, "site");
  add(race.regulations, "regulations");
  add(race.registration, "registration");
  for (const s of race.sources) add(s, "listing");

  const docs: DossierDoc[] = [];
  const thin: { url: string; kind: DossierDoc["kind"] }[] = [];
  for (let i = 0; i < queue.length && docs.length < max; i++) {
    const { url, kind } = queue[i]!;
    const doc = await readDocument(url).catch(() => null);
    if (!doc) continue;
    if (doc.thin) thin.push({ url, kind });
    docs.push({ url, kind, text: doc.text, thisEdition: textNamesEdition(doc.text, race.startDate), classLines: classLineCount(doc.text), thin: doc.thin });
    // From the race's own pages, follow what leads to rules, classes, entry.
    if (doc.html && (kind === "site" || kind === "registration" || (race.seriesName && kind === "linked"))) {
      const words = (race.seriesName ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(cross|bike|cyclocross|202\d)$/.test(w));
      const seriesLink = (label: string) => words.length > 0 && words.filter((w) => label.toLowerCase().includes(w)).length >= Math.min(2, words.length);
      const rank = (l: { url: string; label: string }) => {
        const blob = `${l.label} ${l.url}`;
        return (/ausschreib|reglement|regulamin|propoz|rules|regolament/i.test(blob) ? 8 : 0)
          + (/\.pdf|\.docx|kategori|categor|klassen/i.test(blob) ? 4 : 0) + (seriesLink(l.label) ? 3 : 0)
          + (blob.includes(race.startDate.slice(0, 4)) ? 2 : 0) - (/ergebnis|result|archiv|histor/i.test(blob) ? 20 : 0);
      };
      const links = linksOf(doc.html, url);
      if (race.seriesName) links.sort((a, b) => rank(b) - rank(a));
      for (const l of links) {
        if (queue.length >= max * 2) break;
        if (FOLLOW.test(`${l.label} ${l.url}`) || (race.seriesName && seriesLink(l.label)) || isRegistrationPlatformUrl(l.url)) {
          add(l.url, isRegistrationPlatformUrl(l.url) ? "registration" : "linked");
          // Read a newly found proposition before queued news/footer pages consume maxDocs.
          if (race.seriesName && rank(l) >= 8) {
            const at = queue.findIndex((q) => q.url === directDocumentUrl(l.url));
            if (at > i + 1) queue.splice(i + 1, 0, queue.splice(at, 1)[0]!);
          }
        }
      }
    }
  }
  if (race.render && thin.length) {
    const { renderPagesHtml } = await import("@/lib/watcher/extractors/csc-render");
    const { htmlText } = await import("@/lib/catalog/regulation-ages");
    const rendered = await renderPagesHtml(thin.map((t) => t.url));
    for (const t of thin) {
      const html = rendered.get(t.url);
      if (!html) continue;
      const text = htmlText(html);
      const at = docs.findIndex((d) => d.url === t.url);
      const d: DossierDoc = { url: t.url, kind: t.kind, text, thisEdition: textNamesEdition(text, race.startDate), classLines: classLineCount(text), thin: false };
      if (at >= 0) docs[at] = d;
      else docs.push(d);
    }
  }
  return docs;
}
