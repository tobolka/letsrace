begin;
insert into series(slug,name,name_normalized,website_url,source_url,source_kind,country_code,series_type,level,competition_type,disciplines,description,season)
values
('cesky-pohar-mtbo','Český pohár MTBO','cesky pohar mtbo','https://mtbo.ceskyorientak.cz/','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','national_federation','CZ','cup','national','national_federation',array['mtb'],'Český pohár v orientačních závodech na horských kolech. Kalendář 2027 zahrnuje sedm víkendů v Česku a Rakousku.','2027'),
('mtb-kral-hostynek','MTB král Hostýnek','mtb kral hostynek','https://www.vesani.cz/mtb-kral-hostynek/','https://www.vesani.cz/propozice/','official','CZ','marathon_series','regional','community',array['mtb','xcm'],'Bodovaný místní seriál MTB maratonů. Rohálovská 50ka, Drásal, Hostýnská 50ka, Rusavská 50ka a Zlínská 50ka podle pravidel pořadatele.','2027'),
('ultrabikers-cup','UltraBikers Cup','ultrabikers cup','https://ultrabikers.eu/','https://ultrabikers.eu/calendar-2027/','official','CZ','cup','national','community',array['mtb','gravel','road'],'Celoroční seriál ultracyklistických závodů a výzev na MTB, gravelu a silnici.','2027')
on conflict(slug) do nothing;
with assignments(event_id,slug,source_url,evidence) as (values ('39a6fc31-96e9-431d-90c9-2811c7412fd5','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('97aec3a7-aac3-4ef6-8798-21d90ca1ddd0','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('36878ddd-54c4-482d-a99f-0bbfa0314d19','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('547e9dd0-a712-42d4-a4df-46ba695739ac','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('f705559e-8c58-4a50-b10b-340ba19e0c52','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('6683713d-8659-4db5-84b4-d1136c19df78','cesky-pohar-mtbo','https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/','Kalendář ČP MTBO 2027: Tři Dvory, Nejdek, Mariánské Lázně, Plzeň, Jedovnice, Vrchlabí.'),
('72427d58-6a5b-4a97-860f-c80c77041d3b','mtb-kral-hostynek','https://www.vesani.cz/propozice/','Propozice Rohálovské 50ky 2027 potvrzují zařazení do místní série MTB král Hostýnek.'),
('cc9dace7-377e-4b37-9f5e-d53a3efd0ae1','mtb-kral-hostynek','https://www.vesani.cz/mtb-kral-hostynek/','Oficiální pravidla seriálu zahrnují Rohálovskou 50ku a Rusavskou 50ku; aktivní seriál potvrzují propozice Rohálovské 50ky 2027.'),
('3044fcbe-3b85-42a5-aa66-b9dee3fff9b4','ultrabikers-cup','https://ultrabikers.eu/calendar-2027/','Kalendář UB Cupu 2027 uvádí Moravia Divide 28. 5., Race Across Czechia 15. 7. a UB30 Seven Wineyards Challenge 19. 8.'),
('a0825091-004c-438e-a539-4176640ad411','ultrabikers-cup','https://ultrabikers.eu/calendar-2027/','Kalendář UB Cupu 2027 uvádí Race Across Czechia 15. 7. a UB30 Seven Wineyards Challenge 19. 8.'),
('cd82d70a-89fb-4646-ac28-7217198e560a','ultrabikers-cup','https://ultrabikers.eu/calendar-2027/','Kalendář UB Cupu 2027 uvádí Race Across Czechia 15. 7. a UB30 Seven Wineyards Challenge 19. 8.')),
changed as (
update events e set series_id=s.id,updated_at=now() from assignments a join series s on s.slug=a.slug where e.id=a.event_id::uuid and e.series_id is null returning e.id,e.series_id
), protected as (
insert into event_overrides(event_id,fields,locked_fields,updated_by)
select id,jsonb_build_object('series_id',series_id),array['series_id'],'manual MTB series audit 2026-10-29' from changed
on conflict(event_id) do update set fields=event_overrides.fields || excluded.fields,locked_fields=array(select distinct unnest(event_overrides.locked_fields || excluded.locked_fields)),updated_by=excluded.updated_by,updated_at=now() returning event_id
)
insert into event_facts(event_id,field,value,previous,source_url,quote,method,version)
select c.id,'series_id',to_jsonb(c.series_id),null,a.source_url,a.evidence,'manual','mtb-series-audit-2026-10-29' from changed c join assignments a on a.event_id::uuid=c.id;
insert into event_series(event_id,series_id,is_primary,source)
select e.id,e.series_id,true,'manual MTB series audit 2026-10-29' from events e where e.id in ('39a6fc31-96e9-431d-90c9-2811c7412fd5','97aec3a7-aac3-4ef6-8798-21d90ca1ddd0','36878ddd-54c4-482d-a99f-0bbfa0314d19','547e9dd0-a712-42d4-a4df-46ba695739ac','f705559e-8c58-4a50-b10b-340ba19e0c52','6683713d-8659-4db5-84b4-d1136c19df78','72427d58-6a5b-4a97-860f-c80c77041d3b','cc9dace7-377e-4b37-9f5e-d53a3efd0ae1','3044fcbe-3b85-42a5-aa66-b9dee3fff9b4','a0825091-004c-438e-a539-4176640ad411','cd82d70a-89fb-4646-ac28-7217198e560a')
on conflict(event_id,series_id) do update set is_primary=true,source=excluded.source,updated_at=now();
commit;
