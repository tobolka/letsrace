/**
 * Check what the language model has written so far against the stricter rules,
 * and undo what does not hold up. Reads the run logs; changes a field only if
 * it still holds the value the model wrote.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/audit-llm-writes.ts tmp/a.log tmp/b.log [--apply]
 * Prints the ids whose categories were undone, to be read again strictly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

type Block = { date: string; name: string; lines: string[] };

function blocks(file: string): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const head = raw.match(/^SET  (\d{4}-\d{2}-\d{2})  (.+?)(  entry closes (.+))?$/);
    if (head) {
      cur = { date: head[1]!, name: head[2]!.trim(), lines: head[3] ? [`entry closes ${head[4]}`] : [] };
      out.push(cur);
      continue;
    }
    if (cur && /^      \S/.test(raw)) cur.lines.push(raw.trim());
    else if (!/^      /.test(raw)) cur = null;
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { DISCIPLINE_WORDS } = await import("../src/lib/catalog/llm-enrich");
  const { isRegistrationPlatformUrl } = await import("../src/lib/watcher/registration-url");
  const { ageCategoriesFromList } = await import("../src/lib/age-bands");
  const s = createServerSupabase();
  const REG = /registr|anmeld|nennung|iscri|p[řr]ihl|prihl|zapis|entry|entries|enter|sign.?up|inscri|tickets?|meld/i;
  const REGS = /propoz|regulation|reglement|regulamin|regolamento|ausschreibung|rozpis|bulletin|guide|teilnehmerinfo|rules|pravidl/i;
  const NOT = /harmonogram|schedule|zeitplan|programm|ergebnis|results?|vysledk|wyniki|risultati|classifica|galer|gallery|foto|photo|startlist|news|aktuality/i;
  const DEADLINE = /uz[aá]v[eě]rk|p[řr]ihl|registr|anmeld|nennschluss|meldeschluss|iscrizi|zapis|entr|deadline|closes|bis zum|do\s+\d|until|online/i;
  const tally = { blocks: 0, ok: 0, agesUndone: 0, regUndone: 0, regsUndone: 0, discUndone: 0, deadlineUndone: 0, notFound: 0 };
  const reread: string[] = [];
  for (const file of files) {
    for (const b of blocks(file)) {
      tally.blocks += 1;
      const { data } = await s
        .from("events")
        .select("id, age_categories, age_confidence, registration_url, regulations_url, disciplines, registration_closes_at")
        .eq("start_date", b.date)
        .eq("name", b.name)
        .is("merged_into_id", null)
        .limit(1);
      const e = data?.[0];
      if (!e) {
        tally.notFound += 1;
        continue;
      }
      const patch: Record<string, unknown> = {};
      const why: string[] = [];
      for (const l of b.lines) {
        let m: RegExpMatchArray | null;
        if ((m = l.match(/^ages (\S+)\s+„(.*)“$/))) {
          const logged = m[1]!.split(",");
          const fromQuote = ageCategoriesFromList([{ name: m[2]! }], { refYear: Number(b.date.slice(0, 4)) });
          const same = JSON.stringify(e.age_categories ?? []) === JSON.stringify(logged);
          // Read again unless the one quote we kept already explains the list.
          if (same && !logged.every((a) => fromQuote.includes(a as never) || ["kids", "youth"].includes(a))) {
            patch.age_categories = [];
            patch.age_confidence = null;
            why.push(`ages ${logged.join(",")} from „${m[2]}“`);
            tally.agesUndone += 1;
            reread.push(e.id);
          }
        } else if ((m = l.match(/^registration (\S+)$/))) {
          const u = m[1]!;
          if (e.registration_url === u && (NOT.test(u) || !(isRegistrationPlatformUrl(u) || REG.test(u)))) {
            patch.registration_url = null;
            why.push(`registration ${u}`);
            tally.regUndone += 1;
          }
        } else if ((m = l.match(/^regulations (\S+)$/))) {
          const u = m[1]!;
          if (e.regulations_url === u && (NOT.test(u) || !(/\.pdf(\?|#|$)/i.test(u) || REGS.test(u) || /drive\.google|docs\.google/.test(u)))) {
            patch.regulations_url = null;
            why.push(`regulations ${u}`);
            tally.regsUndone += 1;
          }
        } else if ((m = l.match(/^discipline (\S+)\s+„(.*)“$/)) && !m[1]!.includes("→")) {
          const vals = m[1]!.split(",");
          if (JSON.stringify(e.disciplines ?? []) === JSON.stringify(vals) && !vals.every((v) => DISCIPLINE_WORDS[v]?.test(m![2]!))) {
            patch.disciplines = [];
            why.push(`discipline ${vals.join(",")} from „${m[2]}“`);
            tally.discUndone += 1;
          }
        } else if ((m = l.match(/^entry closes (\d{4}-\d{2}-\d{2})\S*.*„(.*)“/))) {
          if ((e.registration_closes_at ?? "").startsWith(m[1]!) && !DEADLINE.test(m[2]!)) {
            patch.registration_closes_at = null;
            why.push(`deadline ${m[1]} from „${m[2]}“`);
            tally.deadlineUndone += 1;
          }
        }
      }
      if (!Object.keys(patch).length) {
        tally.ok += 1;
        continue;
      }
      console.log(`${apply ? "UNDO" : "DRY "}  ${b.date}  ${b.name}\n        ${why.join("\n        ")}`);
      if (apply) await s.from("events").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", e.id);
    }
  }
  writeFileSync("tmp/llm-reread-ids.txt", [...new Set(reread)].join(","));
  console.log(tally, `\n${new Set(reread).size} ids to read again: tmp/llm-reread-ids.txt`);
}
main().catch((e) => { console.error(e); process.exit(1); });
