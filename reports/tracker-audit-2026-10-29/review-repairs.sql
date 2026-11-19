begin;
do $repair$ declare before_row events%rowtype; after_row events%rowtype; patch jsonb := '{"location_id":"0c19e4c6-a6a6-4729-9308-decbdcd2dd18","disciplines":["tt"],"formats":["tt"],"visibility":"public"}'::jsonb; k text; begin
select * into strict before_row from events where id='f3d57c60-54ab-4bf5-b0a8-e2f2096eaca7' for update;
if before_row.updated_at <> '2026-10-23T21:45:29.293+00:00'::timestamptz or before_row.merged_into_id is not null then raise exception 'Event changed since reviewed snapshot'; end if;
if exists(select 1 from event_overrides o where o.event_id=before_row.id and exists(select 1 from jsonb_object_keys(patch) f where f=any(o.locked_fields))) then raise exception 'Reviewed field is locked'; end if;
update events set location_id=(jsonb_populate_record(null::events,patch)).location_id,disciplines=(jsonb_populate_record(null::events,patch)).disciplines,formats=(jsonb_populate_record(null::events,patch)).formats,visibility=(jsonb_populate_record(null::events,patch)).visibility,updated_at=now() where id=before_row.id returning * into after_row;
for k in select jsonb_object_keys(patch) loop
if (to_jsonb(before_row)->k) is distinct from (to_jsonb(after_row)->k) then
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) values(before_row.id,k,to_jsonb(after_row)->k,to_jsonb(before_row)->k,'https://racetime.sk/terminovka','Structured timing card racetime-173: 2027-08-15, 19. ročník časovky do vrchu Jantex Banské - Mláčky, Banské (okr. Vranov n/T), štart pred kultúrnym domom, Cestná cyklistika. Existing hidden edition had been assigned CZ; correct to SK and make verified edition public.','agent_source_review','2026-10-29-review-v1');
end if;end loop;end $repair$;
do $repair$ declare before_row events%rowtype; after_row events%rowtype; patch jsonb := '{"name":"NyNa Gravel Cup — Gajary","name_normalized":"nyna gravel gajary","start_date":"2026-09-19","end_date":"2026-09-19","location_id":"b41afe66-40c0-4ea1-a39c-ca1071cdfcae","regulations_url":null}'::jsonb; k text; begin
select * into strict before_row from events where id='cf06dbbb-fa41-4b3d-a802-d284edec2530' for update;
if before_row.updated_at <> '2026-10-25T02:31:36.301+00:00'::timestamptz or before_row.merged_into_id is not null then raise exception 'Event changed since reviewed snapshot'; end if;
if exists(select 1 from event_overrides o where o.event_id=before_row.id and exists(select 1 from jsonb_object_keys(patch) f where f=any(o.locked_fields))) then raise exception 'Reviewed field is locked'; end if;
update events set name=(jsonb_populate_record(null::events,patch)).name,name_normalized=(jsonb_populate_record(null::events,patch)).name_normalized,start_date=(jsonb_populate_record(null::events,patch)).start_date,end_date=(jsonb_populate_record(null::events,patch)).end_date,location_id=(jsonb_populate_record(null::events,patch)).location_id,regulations_url=(jsonb_populate_record(null::events,patch)).regulations_url,updated_at=now() where id=before_row.id returning * into after_row;
for k in select jsonb_object_keys(patch) loop
if (to_jsonb(before_row)->k) is distinct from (to_jsonb(after_row)->k) then
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) values(before_row.id,k,to_jsonb(after_row)->k,to_jsonb(before_row)->k,'https://www.soof.sk/podujatia-a-akcie','19.09.2026 - 6.kolo - NYNA Gravel Cup - Gajary. Retained fingerprint and audit history identify Gajary; a shared calendar had overwritten it with other rounds. Restore this identity, reassign two unrelated source links to the already existing correct identities, remove unsupported Zabokreky regulations.','agent_source_review','2026-10-29-review-v1');
end if;end loop;end $repair$;
do $repair$ declare before_row events%rowtype; after_row events%rowtype; patch jsonb := '{"start_date":"2026-08-23","end_date":"2026-08-23","season":"2026","visibility":"public","status":"completed"}'::jsonb; k text; begin
select * into strict before_row from events where id='2f8a3f3c-b0b3-461e-b2e7-95161b8b49d6' for update;
if before_row.updated_at <> '2026-10-29T09:30:58.897018+00:00'::timestamptz or before_row.merged_into_id is not null then raise exception 'Event changed since reviewed snapshot'; end if;
if exists(select 1 from event_overrides o where o.event_id=before_row.id and exists(select 1 from jsonb_object_keys(patch) f where f=any(o.locked_fields))) then raise exception 'Reviewed field is locked'; end if;
update events set start_date=(jsonb_populate_record(null::events,patch)).start_date,end_date=(jsonb_populate_record(null::events,patch)).end_date,season=(jsonb_populate_record(null::events,patch)).season,visibility=(jsonb_populate_record(null::events,patch)).visibility,status=(jsonb_populate_record(null::events,patch)).status,updated_at=now() where id=before_row.id returning * into after_row;
for k in select jsonb_object_keys(patch) loop
if (to_jsonb(before_row)->k) is distinct from (to_jsonb(after_row)->k) then
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) values(before_row.id,k,to_jsonb(after_row)->k,to_jsonb(before_row)->k,'https://www.erg1900.de/','7. RTF Essener Rad Genuss – Sonntag, 23. August 2026. Organizer''s published 2026 article confirms this edition; reused aggregator date 2027-08-01 contradicts both original title and external ids. Retain original name and repair dates to the confirmed 2026 edition.','agent_source_review','2026-10-29-review-v1');
end if;end loop;end $repair$;
update event_sources set event_id='3b0f2efb-1d84-4d6f-b555-1fea52391632' where id='23854278-b476-4805-a4a2-6e5404e48e5a' and event_id='cf06dbbb-fa41-4b3d-a802-d284edec2530';
update event_sources set event_id='71d5b977-658f-4a1b-bedc-770356737272' where id='bb5dbadd-ebc9-47e2-9c6f-4a647c60b33d' and event_id='cf06dbbb-fa41-4b3d-a802-d284edec2530';
update pipeline_candidates set status='conflict',decision=jsonb_build_object('action','wait','reason','Reviewed failed insertion: no event row was inserted; collision belongs to the existing hidden Banské edition with CZ misclassification. Existing edition is now source-corrected to SK; explicit reviewed continuation must target it.','owner','Codex','eventId','f3d57c60-54ab-4bf5-b0a8-e2f2096eaca7'),updated_at=now() where id='ae74ad0e-bfa1-48fb-8a0c-5eb2a9c2cf5c' and status='publishing';
commit;
select id,name,start_date,end_date,visibility from events where id in ('f3d57c60-54ab-4bf5-b0a8-e2f2096eaca7','cf06dbbb-fa41-4b3d-a802-d284edec2530','2f8a3f3c-b0b3-461e-b2e7-95161b8b49d6');
