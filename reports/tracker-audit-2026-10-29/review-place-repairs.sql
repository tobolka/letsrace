begin;
do $place$ declare old_id uuid; new_id uuid; begin
select location_id into strict old_id from events where id='211a0257-58b2-4c90-806a-5d5d62b85f6c' for update;
if old_id<>'18f82943-ada8-46b8-8564-822c1445053b'::uuid then raise exception 'Event location changed';end if;
if exists(select 1 from event_overrides where event_id='211a0257-58b2-4c90-806a-5d5d62b85f6c' and 'location_id'=any(locked_fields)) then raise exception 'Location locked';end if;
insert into locations(name,municipality,venue,country_code,lat,lng,geocode_query,geocode_status,timezone)
select name,'Stropkov','Námestie SNP',country_code,lat,lng,'Stropkov',geocode_status,timezone from locations where id=old_id returning id into new_id;
if true then perform set_location_geog(new_id,21.652,49.202);end if;
update events set location_id=new_id,updated_at=now() where id='211a0257-58b2-4c90-806a-5d5d62b85f6c';
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version)
values('211a0257-58b2-4c90-806a-5d5d62b85f6c','location_id',to_jsonb(new_id),to_jsonb(old_id),'https://racetime.sk/terminovka','Reviewed source separates municipality from the named start venue. Preserve country and previously resolved coordinates; retain old location for audit.','agent_source_review','2026-10-29-review-v1');
end $place$;
do $place$ declare old_id uuid; new_id uuid; begin
select location_id into strict old_id from events where id='32accab5-9f80-4c70-8f85-6c909403b3b2' for update;
if old_id<>'bdb89e40-d586-4f0d-8269-3a1cd03535fa'::uuid then raise exception 'Event location changed';end if;
if exists(select 1 from event_overrides where event_id='32accab5-9f80-4c70-8f85-6c909403b3b2' and 'location_id'=any(locked_fields)) then raise exception 'Location locked';end if;
insert into locations(name,municipality,venue,country_code,lat,lng,geocode_query,geocode_status,timezone)
select name,'Humenné','Námestie Slobody, pred MsKS',country_code,lat,lng,'Humenné',geocode_status,timezone from locations where id=old_id returning id into new_id;
if false then perform set_location_geog(new_id,0,0);end if;
update events set location_id=new_id,updated_at=now() where id='32accab5-9f80-4c70-8f85-6c909403b3b2';
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version)
values('32accab5-9f80-4c70-8f85-6c909403b3b2','location_id',to_jsonb(new_id),to_jsonb(old_id),'https://racetime.sk/terminovka','Reviewed source separates municipality from the named start venue. Preserve country and previously resolved coordinates; retain old location for audit.','agent_source_review','2026-10-29-review-v1');
end $place$;
do $place$ declare old_id uuid; new_id uuid; begin
select location_id into strict old_id from events where id='a8293764-24cb-42af-bdb3-6c159df04513' for update;
if old_id<>'50f4a4d9-0896-428d-997a-f818d28dc642'::uuid then raise exception 'Event location changed';end if;
if exists(select 1 from event_overrides where event_id='a8293764-24cb-42af-bdb3-6c159df04513' and 'location_id'=any(locked_fields)) then raise exception 'Location locked';end if;
insert into locations(name,municipality,venue,country_code,lat,lng,geocode_query,geocode_status,timezone)
select name,'Rajecké Teplice','Kúpalisko Laura',country_code,lat,lng,'Rajecké Teplice',geocode_status,timezone from locations where id=old_id returning id into new_id;
if true then perform set_location_geog(new_id,18.682,49.128);end if;
update events set location_id=new_id,updated_at=now() where id='a8293764-24cb-42af-bdb3-6c159df04513';
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version)
values('a8293764-24cb-42af-bdb3-6c159df04513','location_id',to_jsonb(new_id),to_jsonb(old_id),'https://www.bikepoint.sk/maraton/zakladne-informacie/','Reviewed source separates municipality from the named start venue. Preserve country and previously resolved coordinates; retain old location for audit.','agent_source_review','2026-10-29-review-v1');
end $place$;
commit;

