import { readFileSync } from "node:fs";
(async () => {
  const { readDocument } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("/Users/radektobolka/Documents/GitHub/letsrace/src/lib/watcher/extractors/llm-calendar");
  const rows = JSON.parse(readFileSync("/Users/radektobolka/Documents/GitHub/letsrace/reports/pdf-extraction-2026-11-05/server-review/checked.json", "utf8"));
  const want = /Szutry|Cyklomaraton|NN KIDS|Stupava|FILIPA|Dirndltal|Good Times|Ostalb/;
  const seen = new Set<string>();
  for (const r of rows) {
    if (!want.test(r.name)) continue;
    const urls = [...new Set(r.facts.map((f: any) => f.url))] as string[];
    console.log(`\n#### ${r.date} ${r.name.slice(0, 40)} | quote: ${(r.facts.find((f: any) => f.field === "fees")?.quote ?? "").slice(0, 110)}`);
    for (const url of urls) {
      if (seen.has(url)) { console.log(" (viz výše) " + url.slice(0, 70)); continue; }
      seen.add(url);
      const d = await readDocument(url, { maxBytes: 8e6 }).catch(() => null);
      const t = d ? (d.html ? pageAsText(d.html, url).text : d.text) : "";
      const y = (s: string) => (t.match(new RegExp(s, "g")) ?? []).length;
      console.log(` ${url.slice(0, 80)} znaků=${t.length} 2025:${y("2025")} 2026:${y("2026")} 2027:${y("2027")}`);
      const lines = t.split("\n").map(l => l.replace(/\(https?:[^)]*\)/g, "").trim()).filter(l => /(?:Kč|CZK|PLN|zł|€|EUR)\b|startovn|wpisow|startgeld|štartovn|start\s+\d|\b20(?:26|27)\b/i.test(l)).slice(0, 12);
      for (const l of lines) console.log("   · " + l.slice(0, 130));
    }
  }
})();
