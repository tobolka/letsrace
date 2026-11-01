-- Executed after verifying the organiser's general registration button points here.
begin;
insert into event_facts(event_id,field,value,previous,source_url,method,version,status)
select id,'registration_url','"https://nasecasomira.cz/events/sudety_2027/"'::jsonb,to_jsonb(registration_url),'https://www.sudetytour.cz/','manual_race_fixes_20261101','1','active'
from events where id='258bb5a5-8cc3-4cfb-8726-4211db0fc7a5';
update events set registration_url='https://nasecasomira.cz/events/sudety_2027/',updated_at=now() where id='258bb5a5-8cc3-4cfb-8726-4211db0fc7a5';
update event_overrides set fields=fields||'{"registration_url":"https://nasecasomira.cz/events/sudety_2027/"}'::jsonb,updated_at=now() where event_id='258bb5a5-8cc3-4cfb-8726-4211db0fc7a5';
commit;
