/** How well the second reader catches known errors and leaves correct details alone. Costs a little AI. */
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { join } from "node:path";
const ROOT = "/Users/radektobolka/Documents/GitHub/letsrace/";
(async () => {
  for (const [k, v] of Object.entries(parse(readFileSync(ROOT + ".env.local", "utf8")))) process.env[k] ??= v;
  const model = process.argv[2] || undefined;
  const { readDocument } = await import(ROOT + "src/lib/catalog/regulation-ages");
  const { pageAsText } = await import(ROOT + "src/lib/watcher/extractors/llm-calendar");
  const { checkDetails } = await import(ROOT + "src/lib/catalog/detail-check");
  const R = ROOT + "reports/pdf-extraction-2026-11-05/";
  const read = async (url: string) => { const d = await readDocument(url, { maxBytes: 8e6 }).catch(() => null); return d ? { url, text: d.html ? pageAsText(d.html, url).text : d.text } : null; };
  const live = JSON.parse(readFileSync(R + "morning-2026-11-06/live-cz-sk.json", "utf8")) as any[];
  const before = JSON.parse(readFileSync(R + "server-review/server-before.json", "utf8")) as any[];
  const byLive = (p: string) => live.find(x => x.id.startsWith(p));
  const wrong: any[] = [
    { label: "vstupenky jako startovné", race: { name: "2026-2027 UCI Cyclo-cross World Cup #2, Tábor", start_date: "2026-11-29", municipality: "Tábor" }, field: "fees", fact: byLive("06325f9a").checked.details.fees },
    { label: "série jako pořadatel", race: { name: "TBC — VESELÍ NAD LUŽNICÍ", start_date: "2026-12-06", municipality: "Veselí nad Lužnicí" }, field: "organizer", fact: byLive("f2164309").checked.details.organizer },
    { label: "ředitel seriálu jako pořadatel kola", race: { name: "Oderský pohár — ACK Stará Ves n. O. II.", start_date: "2026-11-08", municipality: "Stará Ves nad Ondřejnicí" }, field: "organizer", fact: byLive("ed72dd49").checked.details.organizer },
    { label: "zákaz vjezdu jako místo", race: { name: "8º TROFEO LE VALLI SUL MINCIO", start_date: "2026-11-08", municipality: "Rivalta sul mincio" }, field: "venue", fact: before.find(x => x.name.startsWith("8º TROFEO")).practical_details.venue },
    { label: "zastaralé startovné", race: { name: "FILIPA Podkrkonošský maraton", start_date: "2027-07-31", municipality: "Lázně Bělohrad" }, field: "fees", fact: before.find(x => x.name.startsWith("FILIPA")).practical_details.fees },
    { label: "propozice jiného závodu (Čuňkov na Hůrku)", race: { name: "TBC — HŮRKA", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice" }, field: "fees", fact: { sourceUrl: "https://spsvd.cz/wp-content/uploads/2026/06/2026_Cunkov_propozice.pdf", value: [{ label: "Muži, ženy", amount: 999, currency: "CZK" }] } },
    { label: "cizí harmonogram (Hůrka na Vimperk, doc Vimperk)", race: { name: "TBC — VIMPERK", start_date: "2026-11-14", municipality: "Vimperk" }, field: "schedule", fact: { sourceUrl: "https://tbcserie.cz/kalendar-2026/zavod-211/", value: [{ label: "večerní běh", date: "2026-11-14", time: "17:00" }, { label: "Otevření prezentace", date: "2026-11-14", time: "08:30" }] } },
    { label: "jiný rok (rozpis 2024 na Brno 2026)", race: { name: "Brněnský cyklokrosový pohár", start_date: "2026-11-07", municipality: "Pisárky" }, field: "venue", fact: { sourceUrl: "https://ascmbrno.cz/wp-content/uploads/Brnensky-cyklokrosovy-pohar-24-rozpis.pdf", value: { name: "Bikearéna Anthropos" } } },
  ];
  const results: any[] = []; let cost = 0;
  const cases: any[] = [];
  for (const w of wrong) cases.push({ expect: "wrong", label: w.label, race: w.race, facts: { [w.field]: w.fact } });
  const golden = readFileSync(R + "session-reading/golden.jsonl", "utf8").trim().split("\n").map(l => JSON.parse(l)).filter((g: any) => Object.keys(g.expected).filter(k => k !== "documents").length);
  const batches = ["batch-01","batch-02","batch-03","batch-04","batch-05"].flatMap(b => JSON.parse(readFileSync(R + `session-reading/${b}.json`, "utf8")));
  for (const g of golden.slice(0, Number(process.argv[3] ?? 12))) {
    const url = g.documents[0]; if (!url) continue;
    const facts = Object.fromEntries(Object.entries(g.expected).filter(([k]) => k !== "documents").map(([k, v]) => [k, { value: v, sourceUrl: url }]));
    cases.push({ expect: "right", label: g.name.slice(0, 40), race: { name: g.name, start_date: g.start_date }, facts });
  }
  for (const c of cases) {
    const urls = [...new Set(Object.values<any>(c.facts).map(f => f.sourceUrl))] as string[];
    const docs = (await Promise.all(urls.map(read))).filter(Boolean) as any[];
    if (!docs.length) { console.log(`--- ${c.label}: dokument nečitelný`); results.push({ ...c, facts: undefined, unreadable: true }); continue; }
    const { checks, costUsd } = await checkDetails(c.race, c.facts, docs, model);
    cost += costUsd; results.push({ expect: c.expect, label: c.label, checks });
    console.log(`${c.expect === "wrong" ? "CHYBA " : "SPRÁVNĚ"} ${c.label.padEnd(44).slice(0, 44)} ${checks.map((x: any) => `${x.field}:${x.verdict}${x.wrong_items?.length ? "(" + x.wrong_items.length + ")" : ""}`).join(" ")} | ${checks.find((x: any) => x.verdict !== "confirmed")?.reason?.slice(0, 90) ?? ""}`);
    writeFileSync(R + `checker/measure-${model ?? "haiku"}.json`, JSON.stringify({ cost, results }, null, 1));
  }
  const wrongs = results.filter(r => r.expect === "wrong" && r.checks), rights = results.filter(r => r.expect === "right" && r.checks);
  const caught = wrongs.filter(r => r.checks.some((x: any) => x.verdict !== "confirmed" || x.wrong_items?.length)).length;
  const fields = rights.flatMap(r => r.checks), falseAlarms = fields.filter((x: any) => !["confirmed"].includes(x.verdict));
  console.log({ model: model ?? "haiku", cost: Number(cost.toFixed(4)), chyb: wrongs.length, zachyceno: caught, spravnychPoli: fields.length, falesnePoplachy: falseAlarms.length });
})();
