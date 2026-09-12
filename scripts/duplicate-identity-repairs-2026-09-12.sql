-- Reviewed annual editions: exact name/date; official race record kept over
-- country-only RaceResult copies. Kouty also shares the exact organizer URL.
begin;
do $$ declare p record; begin
for p in select * from (values
('8eb07e9c-3cb6-4af7-b880-ed965f4c1d1c'::uuid,'0eadb3cc-9ab7-46d9-bb74-936c051bf923'::uuid),
('36f0d2c5-374d-477b-b1c6-63e16df7c4cf'::uuid,'e4a612b0-6263-4a8f-b679-cd2ffeb84766'::uuid),
('dcb16814-5151-4de5-9c28-01d1e6901142'::uuid,'5f4e04d0-ab3c-4579-b8c9-424db86b2c17'::uuid),
('91ef3f24-125b-47e8-890a-c78042693f17'::uuid,'1b84027d-6c10-49d3-9cc1-fb6fe951a0cc'::uuid),
('f7b28c71-3aab-43ec-8851-bf301ca16bfa'::uuid,'2d1e85ac-320d-4ae7-98b3-d77e59d55a9e'::uuid)
) as pairs(keeper,duplicate) loop
if not exists(select 1 from events a join events b on a.start_date=b.start_date and lower(a.name)=lower(b.name) where a.id=p.keeper and b.id=p.duplicate) then raise exception 'Identity changed'; end if;
perform app_merge_events(p.keeper,p.duplicate);
insert into event_overrides(event_id,fields,locked_fields,updated_by)
select id,jsonb_build_object('location_id',location_id),array['location_id'],'catalog identity review 2026-09-12' from events where id=p.keeper
on conflict(event_id) do update set fields=event_overrides.fields||excluded.fields,locked_fields=array(select distinct unnest(event_overrides.locked_fields||excluded.locked_fields));
end loop;
end $$;
commit;
select count(*) as archived_aliases from events where merged_into_id is not null;
