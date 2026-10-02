/**
 * The UCI class of a race, where it is written: in its name or class label
 * ("UCI C1", "(C2)", "1.2"), or on its uci.org competition page. No model.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-uci-class.ts [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

/** "UCI C1", "C2", "XCO HC", "1.2", "2.Pro" → our class id. */
export function uciClassIn(text: string): string | null {
  const t = ` ${text} `;
  const m =
    t.match(/\bUCI[\s-]*(?:XCO|XCM|XCC|CX|DH|MTB|BMX|ROAD)?[\s-]*(HC|C1|C2|C3|1\.1|1\.2|2\.1|2\.2|1\.Pro|2\.Pro|1\.UWT|2\.UWT|WC|World\s*Cup)\b/i) ||
    t.match(/[\s(\[]((?:XCO|XCM|CX)\s*)?(C1|C2|C3|HC)[\s)\],]/) ||
    t.match(/[\s(\[](1\.1|1\.2|2\.1|2\.2|1\.Pro|2\.Pro)[\s)\],]/);
  if (!m) return null;
  const c = (m[m.length - 1] ?? "").toLowerCase().replace(/\s+/g, "");
  if (/uwt|worldcup|wc/.test(c)) return "worldtour";
  if (/pro/.test(c)) return "proseries";
  return ["hc", "c1", "c2", "c3", "1.1", "1.2", "2.1", "2.2"].includes(c) ? c : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: { id: string; name: string; class_label: string | null; sources: { source_url: string | null }[] }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, class_label, sources:event_sources(source_url)").eq("visibility", "public").is("merged_into_id", null).is("uci_class", null).gte("start_date", today).order("id").range(from, from + 999);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  let found = 0;
  for (const r of rows) {
    let c = uciClassIn(`${r.name} ${r.class_label ?? ""}`);
    let from = "name";
    const uci = r.sources.map((x) => x.source_url ?? "").find((u) => /uci\.org\/competition-details/.test(u));
    if (!c && uci) {
      try {
        const html = await (await fetch(uci, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 letsrace" } })).text();
        const m = html.replace(/<[^>]+>/g, " ").match(/Class\s*:?\s*(HC|C1|C2|C3|1\.1|1\.2|2\.1|2\.2|1\.Pro|2\.Pro|1\.UWT|2\.UWT|CDM|WC)\b/i);
        if (m) {
          c = uciClassIn(`UCI ${m[1]}`) ?? (/(CDM|WC)/i.test(m[1]!) ? "worldtour" : null);
          from = uci;
        }
      } catch {
        /* unreachable */
      }
    }
    if (!c) continue;
    found += 1;
    console.log(`${apply ? "SET" : "DRY"}  ${c.padEnd(9)} ${r.name}   (${from})`);
    if (apply) await s.from("events").update({ uci_class: c, updated_at: new Date().toISOString() }).eq("id", r.id);
  }
  console.log({ checked: rows.length, found, dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
