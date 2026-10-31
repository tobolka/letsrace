/** Prepare one reviewed, guarded transaction. This script reads production; SQL is applied separately. */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";

const directory = "reports/cz-2027-import-2026-10-31";
const version = "cz-discoveries-2027-2026-10-31-v1";
// SQL snapshots include evolving columns and nested records; validate identities before generating writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ObjectRow = Record<string, any>;
type Reviewed = { id: string; name: string; source: string; patch: ObjectRow; categories?: ObjectRow[]; location?: ObjectRow; location_patch?: ObjectRow; location_source?: string; previous_id?: string; merge_drop?: string; extra_sources?: string[]; note: string; outcome?: string };
const literal = (v: unknown): string => v == null ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? String(v) : Array.isArray(v) ? `array[${v.map(literal).join(",")}]::text[]` : `'${String(v).replaceAll("'", "''")}'`;
const json = (v: unknown) => `${literal(JSON.stringify(v))}::jsonb`;

async function main() {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").flatMap((l) => { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); return m ? [[m[1], m[2]!.replace(/^["']|["']$/g, "")]] : []; }));
  const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const marker = await s.from("event_facts").select("id").eq("version", version).eq("field", "batch_complete").limit(1);
  if (marker.error) throw marker.error;
  if (marker.data?.length) {
    console.log("Batch already applied; preserving the original transaction and before snapshots.");
    return;
  }
  const plans = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8")) as Reviewed[];
  const ids = [...new Set(plans.flatMap((p) => [p.id, p.previous_id, p.merge_drop].filter(Boolean)))];
  const { data, error } = await s.from("events").select("*,location:locations(*),sources:event_sources(*),overrides:event_overrides(*),categories:event_categories(*)").in("id", ids);
  if (error) throw error;
  if (!data) throw new Error("Missing snapshot");
  writeFileSync(`${directory}/apply-before.json`, JSON.stringify(data, null, 2));
  const rows = new Map(data.map((r: ObjectRow) => [r.id, r]));
  const locations = new Map<string, ObjectRow>();
  const actions: ObjectRow[] = [];
  const sql: string[] = [];
  for (const p of plans) {
    const old = rows.get(p.id);
    const patch = { ...p.patch };
    let loc = p.location;
    if (loc) {
      const key = JSON.stringify(loc);
      loc = locations.get(key) ?? { ...loc, id: crypto.randomUUID() };
      if (!locations.has(key)) {
        locations.set(key, loc);
        sql.push(`insert into locations(${Object.keys(loc).join(",")}) values(${Object.values(loc).map(literal).join(",")});`);
      }
      patch.location_id = loc.id;
    } else loc = old?.location ?? rows.get(p.previous_id ?? "")?.location;
    if (p.location_patch) {
      if (!loc?.id) throw new Error(`Missing location ${p.name}`);
      sql.push(`update locations set ${Object.entries(p.location_patch).map(([k,v]) => `${k}=${literal(v)}`).join(",")},updated_at=now() where id=${literal(loc.id)};`);
      loc = { ...loc, ...p.location_patch };
    }
    if (!old) {
      const previous = rows.get(p.previous_id ?? "");
      // Stable previous-edition location is reused; historical regulations and registration are never cloned.
      if (p.previous_id && !previous) throw new Error(`Missing previous edition ${p.name}`);
      Object.assign(patch, { id: p.id, slug: slugifyEvent(p.name, patch.start_date), name_normalized: normalizeName(p.name), fingerprint: fingerprint({ name: p.name, startDate: patch.start_date, lat: loc?.lat, lng: loc?.lng }), timezone: "Europe/Prague" });
      sql.push(`if exists(select 1 from events e where e.merged_into_id is null and e.start_date between ${literal(patch.start_date)}::date-7 and ${literal(patch.start_date)}::date+7 and (e.slug=${literal(patch.slug)} or e.name_normalized=${literal(patch.name_normalized)})) then raise exception ${literal(`Unreviewed duplicate: ${p.name}`)}; end if;`);
      sql.push(`insert into events(${Object.keys(patch).join(",")}) values(${Object.values(patch).map(literal).join(",")});`);
    } else {
      if (old.merged_into_id) throw new Error(`Already merged: ${p.name}`);
      const guard = Object.fromEntries(["name", "start_date", "end_date", "visibility", "status"].map((k) => [k, old[k]]));
      sql.push(`if not exists(select 1 from events e where e.id=${literal(p.id)} and to_jsonb(e) @> ${json(guard)}) then raise exception ${literal(`Record changed since review: ${p.name}`)}; end if;`);
      if (p.merge_drop) {
        if (!rows.has(p.merge_drop)) throw new Error("Missing merge side");
        sql.push(`perform app_merge_events(${literal(p.id)}::uuid,${literal(p.merge_drop)}::uuid);`);
      }
      if (patch.name || patch.start_date || patch.location_id) patch.fingerprint = fingerprint({ name: patch.name ?? old.name, startDate: patch.start_date ?? old.start_date, lat: loc?.lat, lng: loc?.lng });
      if (Object.keys(patch).length) sql.push(`update events set ${Object.entries(patch).map(([k,v]) => `${k}=${literal(v)}`).join(",")},updated_at=now() where id=${literal(p.id)};`);
    }
    const final = { ...old, ...patch };
    if (p.categories) {
      // Archive the full previous category rows before replacing a reviewed set.
      sql.push(`insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) select ${literal(p.id)},'categories',${json(p.categories)},coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb),${literal(p.source)},${literal(p.note)},'manual_source_review',${literal(version)} from event_categories c where c.event_id=${literal(p.id)};`);
      const used = new Set<string>();
      for (const c of p.categories) {
        const fields = { ...c, event_id: p.id, audience: c.audience ?? (c.name.includes("Dět") || /^D\d/.test(c.name) ? "kids" : final.audience ?? "mixed") };
        const match = old?.categories?.find((x: ObjectRow) => !used.has(x.id) && (x.name === c.name || (c.distance_km != null && x.distance_km === c.distance_km) || (/short|krátk/i.test(x.name) && /short|krátk/i.test(c.name))));
        if (match) {
          used.add(match.id);
          sql.push(`update event_categories set ${Object.entries(fields).map(([k,v])=>`${k}=${literal(v)}`).join(",")} where id=${literal(match.id)};`);
        } else sql.push(`insert into event_categories(${Object.keys(fields).join(",")}) values(${Object.values(fields).map(literal).join(",")});`);
      }
    }
    const protect = Object.fromEntries(["name", "start_date", "end_date", "location_id", "disciplines", "formats", "status", "visibility", "event_type", "website_url", "registration_url", "registration_opens_at", "regulations_url", "age_categories", "age_confidence", "description", "series_id"].filter((k) => final[k] !== undefined).map((k) => [k, final[k]]));
    if (p.categories) protect.categories = p.categories.map((c) => ({ name:c.name, distanceKm:c.distance_km ?? undefined, elevationM:c.elevation_m ?? undefined, ageMin:c.age_min ?? undefined, ageMax:c.age_max ?? undefined, audience:c.audience }));
    sql.push(`insert into event_overrides(event_id,fields,locked_fields,updated_by) values(${literal(p.id)},${json(protect)},${literal(Object.keys(protect))},'official Czech 2027 discoveries review 2026-10-31') on conflict(event_id) do update set fields=event_overrides.fields || excluded.fields,locked_fields=array(select distinct unnest(event_overrides.locked_fields || excluded.locked_fields)),updated_by=excluded.updated_by,updated_at=now();`);
    for (const source of new Set([p.source, ...(p.extra_sources ?? [])])) {
      sql.push(`insert into event_sources(event_id,source_url,kind,external_id,is_canonical) select ${literal(p.id)},${literal(source)},${literal(source.includes("ceskyorientak") ? "national_federation" : "official")},${literal(`${version}:${p.id}:${source}`)},false where not exists(select 1 from event_sources s where s.event_id=${literal(p.id)} and s.source_url=${literal(source)});`);
    }
    sql.push(`insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) select ${literal(p.id)},key,value,${json(old ?? {})}->key,${literal(p.source)},${literal(p.note)},'manual_source_review',${literal(version)} from jsonb_each(${json(protect)});`);
    if (p.previous_id) sql.push(`insert into event_facts(event_id,field,value,source_url,quote,method,version) values(${literal(p.id)},'previous_edition',${json({event_id:p.previous_id,fields:["location_id"],categories_inherited:false})},${literal(`https://letsrace.cz/cs/race/${rows.get(p.previous_id)?.slug}`)},'Stable race identity and established locality from previous edition; 2027-specific information separately verified.','previous_edition',${literal(version)});`);
    if (p.location_patch || p.location) sql.push(`insert into event_facts(event_id,field,value,source_url,quote,method,version) values(${literal(p.id)},'geolocation_review',${json(loc)},${literal(p.location_source ?? "https://www.openstreetmap.org/")},'Verified venue or municipality pin; municipal geocoding is not a confirmed start-line position.','manual_source_review',${literal(version)});`);
    actions.push({ id:p.id,name:final.name,slug:final.slug,start_date:final.start_date,end_date:final.end_date,location:loc,disciplines:final.disciplines,source:p.source,registration_url:final.registration_url,registration_opens_at:final.registration_opens_at,status:final.status,visibility:final.visibility,event_type:final.event_type,action:old ? Object.keys(p.patch).length || p.categories || p.location_patch ? "updated" : "already_correct" : "inserted",outcome:p.outcome ?? "public",merged_id:p.merge_drop,note:p.note,changes:Object.fromEntries(Object.keys(patch).filter(k=>JSON.stringify(old?.[k])!==JSON.stringify(patch[k])).map(k=>[k,{before:old?.[k]??null,after:patch[k]}])) });
  }
  writeFileSync(`${directory}/apply.sql`, `begin;\nselect pg_advisory_xact_lock(hashtext(${literal(version)}));\ndo $$\nbegin\nif exists(select 1 from event_facts where version=${literal(version)} and field='batch_complete') then return; end if;\n${sql.join("\n")}\ninsert into event_facts(event_id,field,value,method,version) values(${literal(plans[0]!.id)},'batch_complete','true'::jsonb,'manual_source_review',${literal(version)});\nend $$;\ncommit;\n`);
  writeFileSync(`${directory}/actions.json`, JSON.stringify(actions, null, 2));
  console.log(JSON.stringify({reviewed:plans.length,inserted:actions.filter(a=>a.action==="inserted").length,updated:actions.filter(a=>a.action==="updated").length,alreadyCorrect:actions.filter(a=>a.action==="already_correct").length,newLocations:locations.size,sqlBytes:readFileSync(`${directory}/apply.sql`).length}));
}
main().catch((e: unknown)=>{console.error(e instanceof Error ? e.message : e);process.exitCode=1;});
