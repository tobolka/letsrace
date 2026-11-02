-- Reviewed primary sources, 2026-11-02. Idempotent data repair; no schema changes.
begin;
select pg_advisory_xact_lock(hashtext('2026-11-02-jbc-roadstage'));
do $$
declare
  eid uuid; lid uuid; sid uuid; wid uuid;
  road constant uuid := '26c164f6-fd6a-4be5-83ca-fa7ed9f4ce3b';
  destne constant uuid := '85cdbe7d-f4ec-44af-b7fe-0689040f313b';
  uci constant text := 'https://www.uci.org/competition-details/2027/MTB/80678';
begin
  perform 1 from events where id=road for update;
  if not found then raise exception 'Existing Road Stage is missing'; end if;
  if (select count(*) from events where (name ilike '%revelation%' or slug ilike '%jbc%4x%') and season='2027' and merged_into_id is null)>1 then
    raise exception 'Ambiguous JBC identity: stop instead of creating another race';
  end if;
  select id into eid from events where (name ilike '%revelation%' or slug ilike '%jbc%4x%') and season='2027' and merged_into_id is null limit 1;
  insert into series(slug,name,name_normalized,disciplines,age_categories,level,competition_type,series_type,source_url,source_kind)
    values('4x-pro-tour','4X Pro Tour','4x pro tour',array['mtb','four_cross'],array['elite'],'international','uci','cup',uci,'federation')
    on conflict(slug) do nothing;
  select id into sid from series where slug='4x-pro-tour';
  select id into lid from locations where country_code='CZ' and municipality='Jablonec nad Nisou' and venue='Areál Dobrá Voda' and abs(lat-50.70933)<0.0001 and abs(lng-15.1610825)<0.0001 limit 1;
  if lid is null then
    insert into locations(name,municipality,venue,region,region_code,country_code,lat,lng,geog,geocode_status,geocode_query)
      values('Areál Dobrá Voda, Jablonec nad Nisou','Jablonec nad Nisou','Areál Dobrá Voda','Liberecký kraj','CZ-51','CZ',50.70933,15.1610825,st_setsrid(st_makepoint(15.1610825,50.70933),4326)::geography,'ok','Turnovská 40, 466 01 Jablonec nad Nisou') returning id into lid;
  end if;
  if eid is null then
    insert into events(slug,name,name_normalized,start_date,end_date,season,fingerprint,location_id,series_id,disciplines,formats,age_categories,age_confidence,audience,level,uci_class,class_label,event_type,competition_type,status,visibility,website_url,source_kind)
      values('jbc-4x-revelations-2027','4X Pro Tour - JBC 4X Revelations','4x pro tour jbc 4x revelations','2027-07-09','2027-07-10','2027','2027-07-09:u34b2:4x pro tour jbc 4x revelations',lid,sid,array['mtb','four_cross'],array['four_cross'],array['elite'],'explicit','adults','international','c3','C3','race','uci','scheduled','public','https://www.jbc4xrevelations.com/','scraped') returning id into eid;
  end if;
  insert into watched_urls(url,kind,status,added_by,notes,next_poll_at)
    values(uci,'federation','active','source_review_2026-11-02','Official UCI edition-specific detail; read data-props using adapter:uci-competition. Empty detail never withdraws a race.',now()+interval '1 day')
    on conflict(url) do nothing;
  select id into wid from watched_urls where url=uci;
  if exists(select 1 from event_sources where watched_url_id=wid and external_id='uci-MTB-80678-2027' and event_id<>eid) then raise exception 'UCI source already belongs to another race'; end if;
  insert into event_sources(event_id,watched_url_id,external_id,source_url,is_canonical,kind)
    values(eid,wid,'uci-MTB-80678-2027',uci,true,'federation') on conflict(watched_url_id,external_id) do nothing;
  insert into event_sources(event_id,source_url,kind)
    select eid,url,'race' from (values('https://www.jbc4xrevelations.com/'),('https://www.jbc4xrevelations.com/en/contact')) v(url)
    where not exists(select 1 from event_sources where event_id=eid and source_url=v.url);
  insert into event_categories(event_id,name,gender,audience)
    select eid,v.name,v.gender,'adults' from (values('Men Elite','male'),('Women Elite','female')) v(name,gender)
    where not exists(select 1 from event_categories where event_id=eid and name=v.name);
  insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select eid,v.field,v.value,v.url,v.quote,'source_review','jbc-roadstage-2026-11-02' from (values
      ('dates','{"startDate":"2027-07-09","endDate":"2027-07-10","uciClass":"c3","categories":["Men Elite","Women Elite"]}'::jsonb,uci,'09 Jul - 10 Jul 2027; Class 3; 4X Men Elite; 4X Women Elite'),
      ('location_id',to_jsonb(lid),'https://www.jbc4xrevelations.com/en/contact','Areál Dobrá Voda; Turnovská 40; linked official Google navigation target 50.70933,15.1610825'),
      ('previous_edition','"1114ef3f-8041-4f25-bdfe-86d429248e27"'::jsonb,uci,'Same official event name and municipality; previous edition retained separately. New dates and categories come from UCI 2027.'),
      ('registration_status','"unconfirmed"'::jsonb,'https://www.jbc4xrevelations.com/en/elite-men-and-women','Organiser programme and registration currently refer to 2026; no 2027 registration copied.'),
      ('kids_programme','"awaiting_2027_announcement"'::jsonb,'https://www.jbc4xrevelations.com/en/kids-race','Official kids page explicitly refers to JBC 4X Revelations 2026; no separate 2027 children event created.')
    )v(field,value,url,quote) where not exists(select 1 from event_facts where event_id=eid and field=v.field and version='jbc-roadstage-2026-11-02');
  insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(eid,jsonb_build_object('start_date','2027-07-09','end_date','2027-07-10','location_id',lid,'disciplines',jsonb_build_array('mtb','four_cross'),'uci_class','c3'),array['start_date','end_date','location_id','disciplines','uci_class'],'Primary source review 2026-11-02')
    on conflict(event_id) do nothing;
  update locations set region='Královéhradecký kraj',region_code='CZ-52',updated_at=now() where id=destne and (region is distinct from 'Královéhradecký kraj' or region_code is distinct from 'CZ-52');
  insert into event_facts(event_id,field,value,previous,source_url,quote,method,version)
    select road,'location_id',to_jsonb(destne),to_jsonb(location_id),'https://www.roadstage.cz/orlicke-hory','Visible MÍSTO and JSON-LD addressLocality both say Deštné v Orlických horách; location.name incorrectly supplies venue label Kikirikiii. Municipality coordinates checked against OSM relation 439909; no exact start line claimed.','source_review','jbc-roadstage-2026-11-02'
    from events where id=road and location_id is distinct from destne;
  update events set location_id=destne,updated_at=now() where id=road and location_id is distinct from destne;
  insert into event_overrides(event_id,fields,locked_fields,updated_by)
    values(road,jsonb_build_object('location_id',destne),array['location_id'],'Primary source review 2026-11-02')
    on conflict(event_id) do update set fields=event_overrides.fields||excluded.fields,
      locked_fields=array(select distinct unnest(event_overrides.locked_fields||excluded.locked_fields)),updated_by=excluded.updated_by,updated_at=now();
  insert into event_categories(event_id,name,distance_km,audience)
    select road,v.name,v.km,'adults' from (values('StageRALLY',69::float8),('Stage69',69::float8),('Stage138',138::float8))v(name,km)
    where not exists(select 1 from event_categories where event_id=road and name=v.name);
  insert into event_facts(event_id,field,value,source_url,quote,method,version)
    select road,'categories','[{"name":"StageRALLY","distanceKm":69},{"name":"Stage69","distanceKm":69},{"name":"Stage138","distanceKm":138}]'::jsonb,'https://www.roadstage.cz/orlicke-hory','StageRALLY – 69 km; Stage69 – 69 km; Stage138 – 138 km','source_review','jbc-roadstage-2026-11-02'
    where not exists(select 1 from event_facts where event_id=road and field='categories' and version='jbc-roadstage-2026-11-02');
end $$;
commit;
