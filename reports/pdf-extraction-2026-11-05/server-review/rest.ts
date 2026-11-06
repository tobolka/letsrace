import { readFileSync } from "node:fs";
(async () => {
  const { readDocument } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/watcher/extractors/llm-calendar");
  const rows = JSON.parse(readFileSync("/Users/radektobolka/Documents/GitHub/letsrace/reports/pdf-extraction-2026-11-05/server-review/checked.json", "utf8"));
  const want = /Dirndltal|Good Times|UPCYCLE|FRANCIACORTA|Niepodleg|Krapf|LE VALLI|4X Pro|Afeno|ORC |Rohálov|Winterfell Night/;
  const seen = new Set<string>();
  const texts = new Map<string,string>();
  const get = async (url: string) => { if(!texts.has(url)){ const d = await readDocument(url, { maxBytes: 8e6 }).catch(() => null); texts.set(url, d ? (d.html ? pageAsText(d.html, url).text : d.text) : ""); } return texts.get(url)!; };
  for (const r of rows) {
    if (!want.test(r.name)) continue;
    console.log(`\n# ${r.date} ${r.name.slice(0, 38)} [${r.town}]`);
    for (const url of [...new Set(r.facts.map((f: any) => f.url))] as string[]) {
      const t = await get(url);
      const again = seen.has(url); seen.add(url);
      const [y, m, d] = r.date.split("-").map(Number);
      const day = new RegExp(`(?<![\\d.])0?${d}\\s*[./]\\s*0?${m}\\b|(?<!\\d)${d}\\.?\\s+(?:nov|listop|novem|dic|dez|gru|listopada)`, "i");
      const lines = t.split("\n").map(l => l.replace(/\(https?:[^)]*\)/g, "").trim()).filter(l => day.test(l) || new RegExp(`\\b${r.town?.split(/[ ,]/)[0] ?? "@@"}\\b`, "i").test(l) && /\d/.test(l));
      console.log(` ${url.replace("https://","").slice(0, 60)} z=${t.length} y25:${(t.match(/2025/g)??[]).length} y26:${(t.match(/2026/g)??[]).length} y27:${(t.match(/2027/g)??[]).length}`);
      if (!again) for (const l of lines.slice(0, 3)) console.log("   · " + l.slice(0, 120));
      for (const f of r.facts) if (f.url === url && ["fees"].includes(f.field)) { const a = f.value[0]?.amount; console.log(`   fee0=${a} ${f.value[0]?.currency} v textu:${new RegExp(`(?<!\\d)${a}(?!\\d)`).test(t)}`); }
    }
  }
  const o = await get("https://www.ostalbgravel.de/alle-infos/anmeldung/"); console.log("\nOSTALB", (o.match(/[^\n]*(?:€|Euro)[^\n]*/g)??[]).slice(0,4).join(" | ").slice(0,240));
  const sz = await get("https://szutrypremium.pl/wp-content/uploads/2026/09/regulamin-2027.pdf"); console.log("SZUTRY", (sz.match(/[^\n]*(?:Organizator|programersi)[^\n]*/gi)??[]).slice(0,3).join(" | ").slice(0,300));
  const fp = await get("https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027/propozice"); console.log("FILIPA", fp.split("\n").filter(l=>/^\s*(90 km|Mladší žáci|Kluci 9)/.test(l)).slice(0,3).join(" || ").slice(0,520));
})();
