import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
const out: any[] = [];
for (const cc of ["DE","AT","CZ"]) for (const yr of ["2026","2027"]) {
  let from=0; const rows:any[]=[];
  for(;;){ const { data, error } = await db.from("events").select("id,name,start_date,status,visibility,disciplines,website_url,registration_url,location:locations!inner(country_code,municipality)").eq("location.country_code",cc).gte("start_date",`${yr}-01-01`).lte("start_date",`${yr}-12-31`).is("merged_into_id",null).range(from,from+999); if(error) throw error; rows.push(...data!); if(data!.length<1000) break; from+=1000; }
  const pub = rows.filter(r=>r.visibility==="public");
  const disc: Record<string,number> = {}; for (const r of pub) for (const d of r.disciplines) disc[d]=(disc[d]??0)+1;
  console.log(cc, yr, "all", rows.length, "public", pub.length, "hidden", rows.length-pub.length, JSON.stringify(disc));
  out.push(...rows.map(r=>({...r,cc,yr})));
}
writeFileSync("reports/de-at-2027-2026-11-16/" + (process.argv[2] ?? "before") + ".json", JSON.stringify(out));
}
main();
