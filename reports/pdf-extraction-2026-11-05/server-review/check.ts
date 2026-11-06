import { readFileSync, writeFileSync } from "node:fs";
(async () => {
  const { readDocument } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/watcher/extractors/llm-calendar");
  const R = "/Users/radektobolka/Documents/GitHub/letsrace/reports/pdf-extraction-2026-11-05/server-review/";
  const rows = JSON.parse(readFileSync(R + "server-before.json", "utf8"));
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  const cache = new Map<string, string | null>();
  const text = async (url: string) => { if (!cache.has(url)) { const d = await readDocument(url, { maxBytes: 8e6 }).catch(() => null); cache.set(url, d ? (d.html ? pageAsText(d.html, url).text : d.text) : null); } return cache.get(url)!; };
  const out: unknown[] = [];
  for (const r of rows) {
    const facts: Record<string, unknown>[] = [];
    for (const [field, f] of Object.entries<any>(r.practical_details)) {
      const t = await text(f.sourceUrl);
      const items = Array.isArray(f.value) ? f.value : [];
      const missing = !t ? ["DOC_UNREADABLE"] : [f.quote, ...items.map((i: any) => i.sourceQuote)].filter(Boolean).filter((q: string) => !fold(t).includes(fold(q).slice(0, 180)));
      const m = (r.start_date as string).split("-").map(Number);
      const statesDay = t ? new RegExp(`(?<![\\d.])0?${m[2]}\\s*[./]\\s*0?${m[1]}(?![\\d])`).test(t) || t.includes(r.start_date) : null;
      facts.push({ field, url: f.sourceUrl, status: f.status, statesDay, quoteMissing: missing.length, value: f.value, quote: String(f.quote).slice(0, 180) });
    }
    out.push({ id: r.id, name: r.name, date: r.start_date, end: r.end_date, town: r.municipality, cc: r.country_code, website: r.website_url, regs: r.regulations_url, facts });
  }
  writeFileSync(R + "checked.json", JSON.stringify(out, null, 1));
  const short = (f: any) => {
    const v = f.value;
    if (f.field === "venue") return [v.name, v.streetAddress, v.locality].filter(Boolean).join(", ");
    if (f.field === "organizer") return v.name;
    if (f.field === "parking") return v.note;
    if (f.field === "schedule") return v.slice(0, 5).map((x: any) => `${x.date.slice(5)} ${x.time} ${x.label.slice(0, 22)}`).join("; ") + (v.length > 5 ? ` +${v.length - 5}` : "");
    if (f.field === "fees") return v.slice(0, 5).map((x: any) => `${x.label.slice(0, 24)}=${x.amount}${x.currency}`).join("; ") + (v.length > 5 ? ` +${v.length - 5}` : "");
    if (f.field === "routes") return v.slice(0, 5).map((x: any) => `${x.name.slice(0, 20)} ${x.distanceKm ?? ""}km`).join("; ");
    return JSON.stringify(v).slice(0, 100);
  };
  for (const r of out as any[]) {
    console.log(`\n## ${r.id.slice(0, 8)} ${r.date} ${r.name.slice(0, 44)} [${r.town ?? "?"} ${r.cc}]`);
    for (const f of r.facts) console.log(` ${f.field} ${f.status === "current" ? "" : "(" + f.status + ") "}${f.statesDay === false ? "DEN-NENI " : ""}${f.quoteMissing ? "CITACE-CHYBI:" + f.quoteMissing + " " : ""}<${new URL(f.url).hostname.replace("www.", "").slice(0, 26)}> ${short(f)}`);
  }
})();
