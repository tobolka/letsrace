/**
 * Are the data right, not just filled? Draw random upcoming races and check
 * each against its own page: does the page name the race, the date and the
 * place we hold? Read-only.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/audit-sample.ts [--n=40]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const MONTHS = [
  ["january", "januar", "leden", "ledna", "gennaio", "stycznia", "janvier", "enero", "januari"],
  ["february", "februar", "unor", "unora", "febbraio", "lutego", "fevrier", "febrero", "februari"],
  ["march", "marz", "maerz", "brezen", "brezna", "marzo", "marca", "mars", "maart"],
  ["april", "duben", "dubna", "aprile", "kwietnia", "avril", "abril"],
  ["may", "mai", "kveten", "kvetna", "maggio", "maja", "mayo", "mei"],
  ["june", "juni", "cerven", "cervna", "giugno", "czerwca", "juin", "junio"],
  ["july", "juli", "cervenec", "cervence", "luglio", "lipca", "juillet", "julio"],
  ["august", "srpen", "srpna", "agosto", "sierpnia", "aout"],
  ["september", "zari", "settembre", "wrzesnia", "septembre", "septiembre"],
  ["october", "oktober", "rijen", "rijna", "ottobre", "pazdziernika", "octobre", "octubre"],
  ["november", "listopad", "listopadu", "novembre", "listopada", "noviembre"],
  ["december", "dezember", "prosinec", "prosince", "dicembre", "grudnia", "decembre", "diciembre"],
];

function dateOnPage(t: string, iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dd = String(d), mm = String(m);
  const D = [dd, dd.padStart(2, "0")];
  const M = [mm, mm.padStart(2, "0")];
  for (const a of D) for (const b of M) {
    if (new RegExp(`(^|\\D)${a}\\s*[./-]\\s*${b}\\s*[./-]?\\s*(${y}|${String(y).slice(2)})?(\\D|$)`).test(t)) return true;
    if (new RegExp(`${y}-${b}-${a}`).test(t)) return true;
  }
  for (const name of MONTHS[m - 1]!) for (const a of D) {
    if (new RegExp(`(^|\\D)${a}\\s*[.]?\\s*(of\\s+)?${name}`).test(t)) return true;
    if (new RegExp(`${name}\\s+${a}(\\D|$)`).test(t)) return true;
  }
  return false;
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const n = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 40);
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const all: { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; disciplines: string[] | null; age_categories: string[] | null; age_confidence: string | null; location: { municipality: string | null; country_code: string | null } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, website_url, registration_url, disciplines, age_categories, age_confidence, location:locations(municipality, country_code)")
      .eq("visibility", "public").is("merged_into_id", null).gte("start_date", today)
      .order("id").range(from, from + 999);
    all.push(...((data ?? []) as unknown as typeof all));
    if (!data || data.length < 1000) break;
  }
  const sample = all.sort(() => Math.random() - 0.5).slice(0, n);
  const rows: string[] = ["verdict\tdate\tcountry\tname\tplace\tdisc\tages\turl\tnotes"];
  const tally: Record<string, number> = {};
  for (const e of sample) {
    const url = e.website_url ?? e.registration_url;
    const place = e.location?.municipality ?? "";
    let verdict = "no-page";
    const notes: string[] = [];
    if (url) {
      try {
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 letsrace-audit" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
        if (!res.ok) { verdict = "unreachable"; notes.push(`HTTP ${res.status}`); }
        else {
          const t = fold((await res.text()).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " "));
          const words = fold(e.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
          const nameHit = words.length ? words.filter((w) => t.includes(w)).length / words.length : 0;
          const dateOk = dateOnPage(t, e.start_date);
          const placeOk = !place || t.includes(fold(place).split(/[,(-]/)[0]!.trim());
          if (nameHit < 0.5) notes.push(`name ${Math.round(nameHit * 100)}%`);
          if (!dateOk) notes.push("date not on page");
          if (!placeOk) notes.push("place not on page");
          verdict = notes.length === 0 ? "ok" : nameHit < 0.5 ? "other-page?" : "check";
        }
      } catch {
        verdict = "unreachable";
        notes.push("timeout/error");
      }
    }
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    rows.push([verdict, e.start_date, e.location?.country_code ?? "", e.name, place, (e.disciplines ?? []).join(","), `${(e.age_categories ?? []).join(",")}${e.age_confidence ? `(${e.age_confidence})` : ""}`, url ?? "", notes.join("; ")].join("\t"));
  }
  const out = `tmp/audit-sample-${today}.tsv`;
  writeFileSync(out, rows.join("\n") + "\n");
  console.log(tally);
  console.log(rows.join("\n"));
  console.log(`\nSaved ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
