with previous as (
 select * from events where id='ccc98479-e044-4062-aac6-2e4111451862'
 and slug='rozmitalsky-cyklokros-2026' and start_date='2026-10-17' and merged_into_id is null
), added as (
 insert into events (slug,name,name_normalized,location_id,start_date,end_date,timezone,disciplines,audience,status,website_url,fingerprint,source_kind,level,class_label,age_categories,age_confidence,formats,event_type,competition_type,season,visibility)
 select 'rozmitalsky-cyklokros-2027',name,name_normalized,location_id,'2027-10-16',null,timezone,disciplines,audience,'scheduled','https://rozmitalskycyklokros.cz/','2027-10-16:u2cf5:rozmitalsky cyklokros','manual',level,class_label,age_categories,'previous',formats,event_type,competition_type,'2027/28','public'
 from previous
 where not exists (select 1 from events where name_normalized='rozmitalsky cyklokros' and start_date='2027-10-16' and merged_into_id is null)
 on conflict do nothing returning *
), watch as (
 insert into watched_urls (url,kind,status,added_by,notes)
 select 'https://rozmitalskycyklokros.cz/','race','active','manual-source-review','Official organiser homepage; explicitly announces 16.10.2027. Annual editions remain separate; 2026 regulations and registration are not confirmed for 2027.'
 from added on conflict(url) do update set status='active'
 returning id
), sources as (
 insert into event_sources (event_id,source_url,kind,is_canonical,watched_url_id,external_id)
 select a.id,'https://rozmitalskycyklokros.cz/','race',true,w.id,'rozmitalsky-cyklokros-2027-10-16' from added a cross join watch w returning id
), confirmed as (
 insert into event_facts(event_id,field,value,source_url,quote,method,version)
 select a.id,'start_date',to_jsonb(a.start_date),'https://rozmitalskycyklokros.cz/',
 '8. ročník je úspěšně za námi. Těšíme se na vás na všechny 16.10.2027',
 'manual_source_review','announced-edition-v1' from added a returning id
), inherited as (
 insert into event_facts(event_id,field,value,source_url,quote,method,version)
 select a.id,f.key,f.value,'https://letsrace.cz/cs/race/rozmitalsky-cyklokros-2026',
 'Inherited from the separately preserved 2026 edition; age categories are marked previous, not confirmed for 2027.',
 'previous_edition','announced-edition-v1'
 from added a cross join lateral jsonb_each(jsonb_build_object(
 'location_id',a.location_id,'disciplines',a.disciplines,'audience',a.audience,'level',a.level,'class_label',a.class_label,
 'age_categories',a.age_categories,'age_confidence',a.age_confidence,'formats',a.formats,'event_type',a.event_type,'competition_type',a.competition_type
 )) f returning id
)
select jsonb_build_object('event',(select to_jsonb(a) from added a),'sources',(select count(*) from sources),'confirmed_facts',(select count(*) from confirmed),'inherited_facts',(select count(*) from inherited),'watch_id',(select id from watch)) as result;
