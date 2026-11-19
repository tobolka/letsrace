import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
const rows = JSON.parse(readFileSync("reports/de-at-2027-2026-11-16/before.json","utf8")).filter((r:any)=>r.yr==="2026" && ["DE","AT"].includes(r.cc) && r.visibility==="public");
const ids = rows.map((r:any)=>r.id);
const src: any[] = [];
for (let i=0;i<ids.length;i+=200){ const { data, error } = await db.from("event_sources").select("event_id,source_url,kind").in("event_id", ids.slice(i,i+200)); if (error) throw error; src.push(...data!); }
const byEvent = new Map<string,string[]>(); for (const s of src) { let h="?"; try { h=new URL(s.source_url).host.replace(/^www\./,""); } catch {} byEvent.set(s.event_id,[...(byEvent.get(s.event_id)??[]),h]); }
const fam = (d:string[]) => d.some(x=>["mtb","xco","xcc","xce","xcm","dh","enduro","four_cross"].includes(x))?"mtb": d.includes("cx")?"cx": d.includes("gravel")?"gravel":"road";
const hostCount: Record<string,number> = {}; const sole: Record<string,number> = {};
for (const r of rows) { if (fam(r.disciplines)!=="mtb") continue; const hs=[...new Set(byEvent.get(r.id)??[])]; for (const h of hs) hostCount[`${r.cc} ${h}`]=(hostCount[`${r.cc} ${h}`]??0)+1; if (hs.length===1) sole[`${r.cc} ${hs[0]}`]=(sole[`${r.cc} ${hs[0]}`]??0)+1; }
console.log("MTB 2026 races per source host (DE/AT), top:"); for (const [h,n] of Object.entries(hostCount).sort((a,b)=>b[1]-a[1]).slice(0,30)) console.log(String(n).padStart(4), h, "sole:", sole[h]??0);
const web: Record<string,number> = {}; for (const r of rows) if (fam(r.disciplines)==="mtb" && r.website_url) { try { const h=new URL(r.website_url).host.replace(/^www\./,""); web[`${r.cc} ${h}`]=(web[`${r.cc} ${h}`]??0)+1; } catch {} }
console.log("\nMTB 2026 races per website host (shared sites = series):"); for (const [h,n] of Object.entries(web).sort((a,b)=>b[1]-a[1]).slice(0,30)) console.log(String(n).padStart(4), h);
}
main();
