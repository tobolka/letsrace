/** Prepare the reviewed, idempotent data transaction; execute through Supabase. */
import { readFileSync, writeFileSync } from "node:fs";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";

const directory = "reports/uci-world-series-2027-2026-10-30";
const source = "https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar";
const rounds = JSON.parse(readFileSync(`${directory}/rounds.json`, "utf8")) as Array<{
  round: number; place: string; start: string; end: string; disciplines: string[];
  cc: string; timezone: string; locationId: string | null; lat: number; lng: number;
  venue: string; region: string; previousEventId?: string;
}>;
const publicCountries = new Set(["CZ", "SK", "AT", "DE", "PL", "CH", "IT"]);
const literal = (v: unknown) => v == null ? "null" : `'${String(v).replaceAll("'", "''")}'`;
const json = (v: unknown) => `${literal(JSON.stringify(v))}::jsonb`;
const statements = rounds.map((r) => {
  const name = `UCI MTB World Cup – ${r.place} 2027`;
  const fields = {
    name, start_date: r.start, end_date: r.end, disciplines: r.disciplines,
    formats: r.disciplines, level: "world_cup", class_label: "UCI World Cup",
    event_type: "race", competition_type: "uci", season: "2027",
    visibility: publicCountries.has(r.cc) ? "public" : "hidden", status: "scheduled",
    series_id: "641843a4-5761-4533-9b46-e61a1e4da868",
    website_url: r.round === 1 ? "https://www.mtbnmnm.com/" : source,
    timezone: r.timezone,
  };
  const ages = r.disciplines.includes("xco") ? ["u23", "elite"] : ["junior", "elite"];
  if (r.disciplines.includes("dh") || r.round === 1) { if (!ages.includes("junior")) ages.unshift("junior"); }
  const description = `WHOOP UCI Mountain Bike World Series 2027, ${r.round}. kolo. Disciplíny: ${r.disciplines.map(d => d.toUpperCase()).join(", ")}. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.` +
    (r.round === 1 ? " UCI samostatně eviduje doprovodnou UCI XCO Junior Series mužů a žen (21.–23. 5. 2027, UCI 80464); nejde o juniorský Světový pohár XCO. Pořadatel uvádí širší termín akce 20.–23. 5. 2027, ale podrobný program na webu je stále pro rok 2026. Náplň 20. 5. 2027 a juniorské XCC pro rok 2027 zatím nejsou potvrzené; světový pohár ukládáme od 21. 5. podle oficiálního kalendáře." : "");
  return `
  -- Round ${r.round}: ${r.place}
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug=${literal(slugifyEvent(name, r.start))}
    or (e.start_date between ${literal(r.start)}::date - 1 and ${literal(r.end)}::date
        and e.level='world_cup' and l.country_code=${literal(r.cc)}
        and (e.name_normalized ilike ${literal(`%${normalizeName(r.place).split(" ")[0]}%`)}
             or (abs(l.lat-${r.lat})<0.1 and abs(l.lng-(${r.lng}))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id=${literal(`reviewed-uciws-2027-round-${r.round}`)}) then
      raise exception 'Existing unreviewed round ${r.round}; inspect before updating';
    end if;
  else
    location_id := ${r.locationId ? `${literal(r.locationId)}::uuid` : "null"};
    if location_id is null then
      select l.id into location_id from locations l where l.name=${literal(r.venue)} and l.country_code=${literal(r.cc)} and abs(l.lat-${r.lat})<0.001 and abs(l.lng-(${r.lng}))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values(${literal(r.venue)},${literal(r.round === 1 ? r.place : r.venue)},${literal(r.venue)},${literal(r.region || null)},${literal(r.cc)},${r.lat},${r.lng},'ok',${literal(r.venue)},${literal(r.timezone)}) returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values(${literal(slugifyEvent(name, r.start))},${literal(name)},${literal(normalizeName(name))},${literal(fingerprint({name,startDate:r.start,lat:r.lat,lng:r.lng}))},${literal(r.start)},${literal(r.end)},array(select jsonb_array_elements_text(${json(r.disciplines)})),array(select jsonb_array_elements_text(${json(r.disciplines)})),'world_cup','UCI World Cup','race','uci','2027',${literal(fields.visibility)},'scheduled',${literal(fields.series_id)}::uuid,${literal(fields.website_url)},${literal(r.timezone)},location_id,'official','mixed',array(select jsonb_array_elements_text(${json(ages)})),${literal(r.previousEventId ? 'previous' : 'default')},${literal(description)}) returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,${literal(source)},${literal(`reviewed-uciws-2027-round-${r.round}`)},true,'official');
    ${r.round === 1 ? `insert into event_sources(event_id,source_url,external_id,is_canonical,kind) values(event_id,'https://www.mtbnmnm.com/','reviewed-nmnm-2027',false,'official'),(event_id,'https://www.uci.org/competition-details/2027/MTB/80464','uci-80464',false,'uci');` : ""}
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,${json(fields)} || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys(${json(fields)})) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,${literal(source)},${literal(`2027 official calendar round ${r.round}: ${r.start} – ${r.end}; ${r.disciplines.join('/')}.`)},'manual','uciws-2027-2026-10-30' from jsonb_each(${json(fields)});
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',${r.lat},'lng',${r.lng}),${literal(r.round === 1 ? "https://www.wikidata.org/wiki/Q29015670" : "https://www.openstreetmap.org/")},'Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;`;
});
writeFileSync(`${directory}/apply.sql`, `begin;\nselect pg_advisory_xact_lock(hashtext('reviewed-uci-world-series-2027'));\ndo $$\n#variable_conflict use_variable\ndeclare event_id uuid; location_id uuid;\nbegin\n${statements.join("\n")}\nend $$;\ncommit;\n`);
console.log(`Prepared ${rounds.length} rounds; ${rounds.filter(r=>publicCountries.has(r.cc)).length} public.`);
