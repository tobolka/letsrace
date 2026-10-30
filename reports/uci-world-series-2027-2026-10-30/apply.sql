begin;
select pg_advisory_xact_lock(hashtext('reviewed-uci-world-series-2027'));
do $$
#variable_conflict use_variable
declare event_id uuid; location_id uuid;
begin

  -- Round 1: Nové Město na Moravě
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-nove-mesto-na-morave-2027'
    or (e.start_date between '2027-05-21'::date - 1 and '2027-05-23'::date
        and e.level='world_cup' and l.country_code='CZ'
        and (e.name_normalized ilike '%nove%'
             or (abs(l.lat-49.577263)<0.1 and abs(l.lng-(16.053323))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-1') then
      raise exception 'Existing unreviewed round 1; inspect before updating';
    end if;
  else
    location_id := null;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Vysočina Arena' and l.country_code='CZ' and abs(l.lat-49.577263)<0.001 and abs(l.lng-(16.053323))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Vysočina Arena','Nové Město na Moravě','Vysočina Arena','Kraj Vysočina','CZ',49.577263,16.053323,'ok','Vysočina Arena','Europe/Prague') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-nove-mesto-na-morave-2027','UCI MTB World Cup – Nové Město na Moravě 2027','uci world nove mesto na morave','2027-05-21:u2g6j:uci world nove mesto na morave','2027-05-21','2027-05-23',array(select jsonb_array_elements_text('["xco","xcc"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','public','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://www.mtbnmnm.com/','Europe/Prague',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 1. kolo. Disciplíny: XCO, XCC. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027. UCI samostatně eviduje doprovodnou UCI XCO Junior Series mužů a žen (21.–23. 5. 2027, UCI 80464); nejde o juniorský Světový pohár XCO. Pořadatel uvádí širší termín akce 20.–23. 5. 2027, ale podrobný program na webu je stále pro rok 2026. Náplň 20. 5. 2027 a juniorské XCC pro rok 2027 zatím nejsou potvrzené; světový pohár ukládáme od 21. 5. podle oficiálního kalendáře.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-1',true,'official');
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind) values(event_id,'https://www.mtbnmnm.com/','reviewed-nmnm-2027',false,'official'),(event_id,'https://www.uci.org/competition-details/2027/MTB/80464','uci-80464',false,'uci');
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Nové Město na Moravě 2027","start_date":"2027-05-21","end_date":"2027-05-23","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://www.mtbnmnm.com/","timezone":"Europe/Prague"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Nové Město na Moravě 2027","start_date":"2027-05-21","end_date":"2027-05-23","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://www.mtbnmnm.com/","timezone":"Europe/Prague"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 1: 2027-05-21 – 2027-05-23; xco/xcc.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Nové Město na Moravě 2027","start_date":"2027-05-21","end_date":"2027-05-23","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://www.mtbnmnm.com/","timezone":"Europe/Prague"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',49.577263,'lng',16.053323),'https://www.wikidata.org/wiki/Q29015670','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 2: Loudenvielle – Peyragudes
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-loudenvielle-peyragudes-2027'
    or (e.start_date between '2027-05-29'::date - 1 and '2027-05-30'::date
        and e.level='world_cup' and l.country_code='FR'
        and (e.name_normalized ilike '%loudenvielle%'
             or (abs(l.lat-42.796)<0.1 and abs(l.lng-(0.412))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-2') then
      raise exception 'Existing unreviewed round 2; inspect before updating';
    end if;
  else
    location_id := '982addff-b204-490d-83af-aa9dbc4aec07'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Loudenvielle' and l.country_code='FR' and abs(l.lat-42.796)<0.001 and abs(l.lng-(0.412))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Loudenvielle','Loudenvielle','Loudenvielle',null,'FR',42.796,0.412,'ok','Loudenvielle','Europe/Paris') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-loudenvielle-peyragudes-2027','UCI MTB World Cup – Loudenvielle – Peyragudes 2027','uci world loudenvielle peyragudes','2027-05-29:sp873:uci world loudenvielle peyragudes','2027-05-29','2027-05-30',array(select jsonb_array_elements_text('["dh"]'::jsonb)),array(select jsonb_array_elements_text('["dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','hidden','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Paris',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 2. kolo. Disciplíny: DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-2',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Loudenvielle – Peyragudes 2027","start_date":"2027-05-29","end_date":"2027-05-30","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Loudenvielle – Peyragudes 2027","start_date":"2027-05-29","end_date":"2027-05-30","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 2: 2027-05-29 – 2027-05-30; dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Loudenvielle – Peyragudes 2027","start_date":"2027-05-29","end_date":"2027-05-30","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',42.796,'lng',0.412),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 3: Saalfelden Leogang – Salzburgerland
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-saalfelden-leogang-salzburgerland-2027'
    or (e.start_date between '2027-06-11'::date - 1 and '2027-06-13'::date
        and e.level='world_cup' and l.country_code='AT'
        and (e.name_normalized ilike '%saalfelden%'
             or (abs(l.lat-47.4392674)<0.1 and abs(l.lng-(12.718724))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-3') then
      raise exception 'Existing unreviewed round 3; inspect before updating';
    end if;
  else
    location_id := null;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Bikepark Leogang' and l.country_code='AT' and abs(l.lat-47.4392674)<0.001 and abs(l.lng-(12.718724))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Bikepark Leogang','Bikepark Leogang','Bikepark Leogang','Salzburg','AT',47.4392674,12.718724,'ok','Bikepark Leogang','Europe/Vienna') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-saalfelden-leogang-salzburgerland-2027','UCI MTB World Cup – Saalfelden Leogang – Salzburgerland 2027','uci world saalfelden leogang salzburgerland','2027-06-11:u23jc:uci world saalfelden leogang salzburgerland','2027-06-11','2027-06-13',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','public','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Vienna',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 3. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-3',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Saalfelden Leogang – Salzburgerland 2027","start_date":"2027-06-11","end_date":"2027-06-13","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Vienna"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Saalfelden Leogang – Salzburgerland 2027","start_date":"2027-06-11","end_date":"2027-06-13","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Vienna"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 3: 2027-06-11 – 2027-06-13; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Saalfelden Leogang – Salzburgerland 2027","start_date":"2027-06-11","end_date":"2027-06-13","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Vienna"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',47.4392674,'lng',12.718724),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 4: Les Gets – Haute-Savoie
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-les-gets-haute-savoie-2027'
    or (e.start_date between '2027-06-18'::date - 1 and '2027-06-20'::date
        and e.level='world_cup' and l.country_code='FR'
        and (e.name_normalized ilike '%les%'
             or (abs(l.lat-46.1550977)<0.1 and abs(l.lng-(6.6633354))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-4') then
      raise exception 'Existing unreviewed round 4; inspect before updating';
    end if;
  else
    location_id := null;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Les Gets' and l.country_code='FR' and abs(l.lat-46.1550977)<0.001 and abs(l.lng-(6.6633354))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Les Gets','Les Gets','Les Gets','Haute-Savoie','FR',46.1550977,6.6633354,'ok','Les Gets','Europe/Paris') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-les-gets-haute-savoie-2027','UCI MTB World Cup – Les Gets – Haute-Savoie 2027','uci world les gets haute savoie','2027-06-18:u0hwx:uci world les gets haute savoie','2027-06-18','2027-06-20',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','hidden','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Paris',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 4. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-4',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Les Gets – Haute-Savoie 2027","start_date":"2027-06-18","end_date":"2027-06-20","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Les Gets – Haute-Savoie 2027","start_date":"2027-06-18","end_date":"2027-06-20","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 4: 2027-06-18 – 2027-06-20; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Les Gets – Haute-Savoie 2027","start_date":"2027-06-18","end_date":"2027-06-20","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Paris"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',46.1550977,'lng',6.6633354),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 5: La Thuile – Valle d’Aosta
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-la-thuile-valle-d-aosta-2027'
    or (e.start_date between '2027-07-02'::date - 1 and '2027-07-04'::date
        and e.level='world_cup' and l.country_code='IT'
        and (e.name_normalized ilike '%la%'
             or (abs(l.lat-45.714)<0.1 and abs(l.lng-(6.913))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-5') then
      raise exception 'Existing unreviewed round 5; inspect before updating';
    end if;
  else
    location_id := '6ee00312-92c4-4c13-bd2d-855f26fa0e1c'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='La Thuile' and l.country_code='IT' and abs(l.lat-45.714)<0.001 and abs(l.lng-(6.913))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('La Thuile','La Thuile','La Thuile','Valle d’Aosta','IT',45.714,6.913,'ok','La Thuile','Europe/Rome') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-la-thuile-valle-d-aosta-2027','UCI MTB World Cup – La Thuile – Valle d’Aosta 2027','uci world la thuile valle d aosta','2027-07-02:u0huj:uci world la thuile valle d aosta','2027-07-02','2027-07-04',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','public','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Rome',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 5. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-5',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – La Thuile – Valle d’Aosta 2027","start_date":"2027-07-02","end_date":"2027-07-04","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – La Thuile – Valle d’Aosta 2027","start_date":"2027-07-02","end_date":"2027-07-04","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 5: 2027-07-02 – 2027-07-04; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – La Thuile – Valle d’Aosta 2027","start_date":"2027-07-02","end_date":"2027-07-04","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',45.714,'lng',6.913),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 6: Pal Arinsal
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-pal-arinsal-2027'
    or (e.start_date between '2027-07-09'::date - 1 and '2027-07-11'::date
        and e.level='world_cup' and l.country_code='AD'
        and (e.name_normalized ilike '%pal%'
             or (abs(l.lat-42.552408)<0.1 and abs(l.lng-(1.4495827))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-6') then
      raise exception 'Existing unreviewed round 6; inspect before updating';
    end if;
  else
    location_id := null;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Pal-Arinsal' and l.country_code='AD' and abs(l.lat-42.552408)<0.001 and abs(l.lng-(1.4495827))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Pal-Arinsal','Pal-Arinsal','Pal-Arinsal','La Massana','AD',42.552408,1.4495827,'ok','Pal-Arinsal','Europe/Andorra') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-pal-arinsal-2027','UCI MTB World Cup – Pal Arinsal 2027','uci world pal arinsal','2027-07-09:sp940:uci world pal arinsal','2027-07-09','2027-07-11',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','hidden','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Andorra',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 6. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-6',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Pal Arinsal 2027","start_date":"2027-07-09","end_date":"2027-07-11","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Andorra"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Pal Arinsal 2027","start_date":"2027-07-09","end_date":"2027-07-11","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Andorra"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 6: 2027-07-09 – 2027-07-11; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Pal Arinsal 2027","start_date":"2027-07-09","end_date":"2027-07-11","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Andorra"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',42.552408,'lng',1.4495827),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 7: Bike Kingdom Lenzerheide
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-bike-kingdom-lenzerheide-2027'
    or (e.start_date between '2027-08-20'::date - 1 and '2027-08-22'::date
        and e.level='world_cup' and l.country_code='CH'
        and (e.name_normalized ilike '%bike%'
             or (abs(l.lat-46.728)<0.1 and abs(l.lng-(9.558))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-7') then
      raise exception 'Existing unreviewed round 7; inspect before updating';
    end if;
  else
    location_id := '0282fb7b-4a22-475f-9f89-3b38df99f221'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Lenzerheide' and l.country_code='CH' and abs(l.lat-46.728)<0.001 and abs(l.lng-(9.558))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Lenzerheide','Lenzerheide','Lenzerheide','Graubünden','CH',46.728,9.558,'ok','Lenzerheide','Europe/Zurich') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-bike-kingdom-lenzerheide-2027','UCI MTB World Cup – Bike Kingdom Lenzerheide 2027','uci world bike kingdom lenzerheide','2027-08-20:u0qcc:uci world bike kingdom lenzerheide','2027-08-20','2027-08-22',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','public','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Zurich',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'previous','WHOOP UCI Mountain Bike World Series 2027, 7. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-7',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Bike Kingdom Lenzerheide 2027","start_date":"2027-08-20","end_date":"2027-08-22","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Zurich"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Bike Kingdom Lenzerheide 2027","start_date":"2027-08-20","end_date":"2027-08-22","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Zurich"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 7: 2027-08-20 – 2027-08-22; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Bike Kingdom Lenzerheide 2027","start_date":"2027-08-20","end_date":"2027-08-22","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Zurich"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',46.728,'lng',9.558),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 8: Val di Sole – Trentino
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-val-di-sole-trentino-2027'
    or (e.start_date between '2027-09-10'::date - 1 and '2027-09-12'::date
        and e.level='world_cup' and l.country_code='IT'
        and (e.name_normalized ilike '%val%'
             or (abs(l.lat-46.3196181)<0.1 and abs(l.lng-(10.836164))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-8') then
      raise exception 'Existing unreviewed round 8; inspect before updating';
    end if;
  else
    location_id := 'd6b84589-8f9c-40fb-ae6a-c2e7874c400a'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Daolasa, Commezzadura' and l.country_code='IT' and abs(l.lat-46.3196181)<0.001 and abs(l.lng-(10.836164))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Daolasa, Commezzadura','Daolasa, Commezzadura','Daolasa, Commezzadura','Trentino','IT',46.3196181,10.836164,'ok','Daolasa, Commezzadura','Europe/Rome') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-val-di-sole-trentino-2027','UCI MTB World Cup – Val di Sole – Trentino 2027','uci world val di sole trentino','2027-09-10:u0pxw:uci world val di sole trentino','2027-09-10','2027-09-12',array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc","dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','public','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','Europe/Rome',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","u23","elite"]'::jsonb)),'default','WHOOP UCI Mountain Bike World Series 2027, 8. kolo. Disciplíny: XCO, XCC, DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-8',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Val di Sole – Trentino 2027","start_date":"2027-09-10","end_date":"2027-09-12","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Val di Sole – Trentino 2027","start_date":"2027-09-10","end_date":"2027-09-12","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 8: 2027-09-10 – 2027-09-12; xco/xcc/dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Val di Sole – Trentino 2027","start_date":"2027-09-10","end_date":"2027-09-12","disciplines":["xco","xcc","dh"],"formats":["xco","xcc","dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"public","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"Europe/Rome"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',46.3196181,'lng',10.836164),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 9: Soldier Hollow – Midway, Utah
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-soldier-hollow-midway-utah-2027'
    or (e.start_date between '2027-09-25'::date - 1 and '2027-09-26'::date
        and e.level='world_cup' and l.country_code='US'
        and (e.name_normalized ilike '%soldier%'
             or (abs(l.lat-40.483)<0.1 and abs(l.lng-(-111.495))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-9') then
      raise exception 'Existing unreviewed round 9; inspect before updating';
    end if;
  else
    location_id := '83831738-7f44-47e1-9eeb-0c09965b3053'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Soldier Hollow' and l.country_code='US' and abs(l.lat-40.483)<0.001 and abs(l.lng-(-111.495))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Soldier Hollow','Soldier Hollow','Soldier Hollow','Utah','US',40.483,-111.495,'ok','Soldier Hollow','America/Denver') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-soldier-hollow-midway-utah-2027','UCI MTB World Cup – Soldier Hollow – Midway, Utah 2027','uci world soldier hollow midway utah','2027-09-25:9x0wq:uci world soldier hollow midway utah','2027-09-25','2027-09-26',array(select jsonb_array_elements_text('["xco","xcc"]'::jsonb)),array(select jsonb_array_elements_text('["xco","xcc"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','hidden','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','America/Denver',location_id,'official','mixed',array(select jsonb_array_elements_text('["u23","elite"]'::jsonb)),'default','WHOOP UCI Mountain Bike World Series 2027, 9. kolo. Disciplíny: XCO, XCC. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-9',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Soldier Hollow – Midway, Utah 2027","start_date":"2027-09-25","end_date":"2027-09-26","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Denver"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Soldier Hollow – Midway, Utah 2027","start_date":"2027-09-25","end_date":"2027-09-26","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Denver"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 9: 2027-09-25 – 2027-09-26; xco/xcc.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Soldier Hollow – Midway, Utah 2027","start_date":"2027-09-25","end_date":"2027-09-26","disciplines":["xco","xcc"],"formats":["xco","xcc"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Denver"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',40.483,'lng',-111.495),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;

  -- Round 10: Whistler Mountain Bike Park
  select e.id into event_id from events e left join locations l on l.id=e.location_id
  where e.season='2027' and (e.slug='uci-mtb-world-cup-whistler-mountain-bike-park-2027'
    or (e.start_date between '2027-10-02'::date - 1 and '2027-10-03'::date
        and e.level='world_cup' and l.country_code='CA'
        and (e.name_normalized ilike '%whistler%'
             or (abs(l.lat-50.1163)<0.1 and abs(l.lng-(-122.9574))<0.1))))
  limit 1;
  if event_id is not null then
    if not exists(select 1 from event_sources where event_sources.event_id=event_id and external_id='reviewed-uciws-2027-round-10') then
      raise exception 'Existing unreviewed round 10; inspect before updating';
    end if;
  else
    location_id := '3fef3453-6bf4-4964-9d60-9380eb4b716f'::uuid;
    if location_id is null then
      select l.id into location_id from locations l where l.name='Whistler Mountain Bike Park' and l.country_code='CA' and abs(l.lat-50.1163)<0.001 and abs(l.lng-(-122.9574))<0.001 limit 1;
    end if;
    if location_id is null then
      insert into locations(name,municipality,venue,region,country_code,lat,lng,geocode_status,geocode_query,timezone)
      values('Whistler Mountain Bike Park','Whistler Mountain Bike Park','Whistler Mountain Bike Park','British Columbia','CA',50.1163,-122.9574,'ok','Whistler Mountain Bike Park','America/Vancouver') returning id into location_id;
    end if;
    insert into events(slug,name,name_normalized,fingerprint,start_date,end_date,disciplines,formats,level,class_label,event_type,competition_type,season,visibility,status,series_id,website_url,timezone,location_id,source_kind,audience,age_categories,age_confidence,description)
    values('uci-mtb-world-cup-whistler-mountain-bike-park-2027','UCI MTB World Cup – Whistler Mountain Bike Park 2027','uci world whistler mountain bike park','2027-10-02:c2bt4:uci world whistler mountain bike park','2027-10-02','2027-10-03',array(select jsonb_array_elements_text('["dh"]'::jsonb)),array(select jsonb_array_elements_text('["dh"]'::jsonb)),'world_cup','UCI World Cup','race','uci','2027','hidden','scheduled','641843a4-5761-4533-9b46-e61a1e4da868'::uuid,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','America/Vancouver',location_id,'official','mixed',array(select jsonb_array_elements_text('["junior","elite"]'::jsonb)),'default','WHOOP UCI Mountain Bike World Series 2027, 10. kolo. Disciplíny: DH. Termín víkendu je potvrzený oficiálním kalendářem; rozpis jednotlivých závodů a registrace pro rok 2027 zatím nejsou potvrzené. Věkové filtry vycházejí ze standardních kategorií seriálu; nejde o ověřený úplný rozpis 2027.') returning id into event_id;
    insert into event_sources(event_id,source_url,external_id,is_canonical,kind)
    values(event_id,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','reviewed-uciws-2027-round-10',true,'official');
    
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(event_id,'{"name":"UCI MTB World Cup – Whistler Mountain Bike Park 2027","start_date":"2027-10-02","end_date":"2027-10-03","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Vancouver"}'::jsonb || jsonb_build_object('location_id',location_id),array(select jsonb_object_keys('{"name":"UCI MTB World Cup – Whistler Mountain Bike Park 2027","start_date":"2027-10-02","end_date":"2027-10-03","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Vancouver"}'::jsonb)) || array['location_id'],'official UCI 2027 calendar review 2026-10-30');
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select event_id,key,value,'https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar','2027 official calendar round 10: 2027-10-02 – 2027-10-03; dh.','manual','uciws-2027-2026-10-30' from jsonb_each('{"name":"UCI MTB World Cup – Whistler Mountain Bike Park 2027","start_date":"2027-10-02","end_date":"2027-10-03","disciplines":["dh"],"formats":["dh"],"level":"world_cup","class_label":"UCI World Cup","event_type":"race","competition_type":"uci","season":"2027","visibility":"hidden","status":"scheduled","series_id":"641843a4-5761-4533-9b46-e61a1e4da868","website_url":"https://vercel.ucimtbworldseries.com/news/whoop-uci-mountain-bike-world-series-confirms-2027-calendar","timezone":"America/Vancouver"}'::jsonb);
    insert into event_facts(event_id,field,value,source_url,quote,method,version)
    values(event_id,'location_id',jsonb_build_object('id',location_id,'lat',50.1163,'lng',-122.9574),'https://www.openstreetmap.org/','Venue/locality map pin; not a confirmed 2027 start-line position.','manual','uciws-2027-2026-10-30');
  end if;
  event_id := null;
  location_id := null;
end $$;
commit;
