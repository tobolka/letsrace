begin;
do $$
declare pair record; loc uuid;
begin
  for pair in select * from (values
    ('ef93c8b0-5c96-48e0-be1f-f99a518a451b'::uuid,'b39c4fbd-6b84-4cc0-a1fe-b56cfc2bd928'::uuid,'2026-09-13'::date),
    ('70c5f6d4-53d4-40b0-bc74-a80459e305b8'::uuid,'9bd0dd10-ef8f-40ca-b5c8-c6defea64a08'::uuid,'2026-09-19'::date),
    ('5ec27b24-55f8-4019-bffd-ebd586340977'::uuid,'73155e79-9c59-47ef-9612-cb21d23cef90'::uuid,'2026-09-27'::date),
    ('8eab629b-d135-4a46-9bef-d984f7fe07ae'::uuid,'63b2b34d-52ce-4b78-9282-e901f7e3dcfb'::uuid,'2026-12-13'::date)
  ) as pairs(keeper,duplicate,race_date) loop
    if (select count(*) from events where id in (pair.keeper,pair.duplicate) and start_date=pair.race_date)<>2 then raise exception 'Race edition changed'; end if;
    perform app_merge_events(pair.keeper,pair.duplicate);
    insert into event_overrides(event_id,fields,locked_fields,updated_by)
      select id,jsonb_build_object('location_id',location_id),array['location_id'],'verified catalog review 2026-09-11' from events where id=pair.keeper
      on conflict(event_id) do update set fields=event_overrides.fields||excluded.fields,locked_fields=array(select distinct unnest(event_overrides.locked_fields||excluded.locked_fields));
  end loop;
  update events set regulations_url='https://stopnuto.cz/propozice/casovka-na-klet-2026' where id='ef93c8b0-5c96-48e0-be1f-f99a518a451b' and regulations_url is null;
  select id into loc from locations where name='Georg Weichand Sportanlage' and municipality='Markgrafneusiedl' and country_code='AT' limit 1;
  if loc is null then
    insert into locations(name,municipality,country_code,lat,lng,geocode_status,geocode_query)
    values('Georg Weichand Sportanlage','Markgrafneusiedl','AT',48.27268535237128,16.62480882898895,'ok','Organizer: https://team-bikestore.sportunion.at/cross-rennen/') returning id into loc;
  end if;
  update events set location_id=loc where id='8eab629b-d135-4a46-9bef-d984f7fe07ae';
  update event_overrides set fields=fields||jsonb_build_object('location_id',loc) where event_id='8eab629b-d135-4a46-9bef-d984f7fe07ae';
end $$;
commit;
select e.name,e.merged_into_id,l.municipality,l.lat,l.lng from events e left join locations l on l.id=e.location_id where e.id in ('ef93c8b0-5c96-48e0-be1f-f99a518a451b','b39c4fbd-6b84-4cc0-a1fe-b56cfc2bd928','70c5f6d4-53d4-40b0-bc74-a80459e305b8','5ec27b24-55f8-4019-bffd-ebd586340977','8eab629b-d135-4a46-9bef-d984f7fe07ae');
