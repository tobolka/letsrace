/** Read-only copy of the catalogue rows this review touches. Usage: tsx snapshot.ts <output.json> */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }
async function main() {
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const slugs = ["cyklomaraton-hradec-kralove-2027", "nn-kids-race-2027", "ostalb-gravel-2027", "dirndltal-race-gravel-mtb-2027", "good-times-gravel-2027", "wiosenne-szutry-premium-2027", "letnie-szutry-premium-2027", "jesienne-szutry-premium-2027", "bajkservis-stupava-maraton-mtb-2027", "detsky-mtb-cyklomaratonik-stupava-2027", "bajkservis-stupava-mtb-sprint-biely-kriz-2027", "stupava-winter-mtb-marathon-2027"];
const { data, error } = await db.from("events").select("*,location:locations(*),overrides:event_overrides(*),categories:event_categories(*),sources:event_sources(*),series:event_series(*)").in("slug", slugs).order("slug");
if (error) throw error;
writeFileSync(process.argv[2]!, JSON.stringify(data, null, 1) + "\n");
console.log(data!.length, "rows");
}
main().catch(e => { console.error(e); process.exit(1); });
