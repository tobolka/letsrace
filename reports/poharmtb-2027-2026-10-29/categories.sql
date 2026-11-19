begin;
with changed as (
update events set
age_categories=array['u13','u15','u17','youth','junior','u23','elite','amateur','masters'],
age_confidence='explicit',
uci_class=case when uci_class='C1' then 'c1' else uci_class end,
class_label=case when uci_class in ('C1','c1') then 'UCI C1' else class_label end,
description=description || E'\n\nKategorie XCO podle předběžného rozpisu 2027: žáci I a II, žákyně I a II, kadeti a kadetky, junioři a juniorky, muži a ženy U23/Elite, masters a experti. XCC: pouze junioři, juniorky, muži a ženy U23/Elite. Žáci a kadeti jsou mládežnické kategorie; dětské kategorie nejsou součástí poháru. Zařazení dětí 9–10 let zatím není potvrzené.',
updated_at=now()
where series_id='f5a31302-4fd7-4128-8abc-c1835e7159df' and season='2027' and merged_into_id is null
returning id,age_categories,age_confidence,uci_class
), protected as (
insert into event_overrides(event_id,fields,locked_fields,updated_by)
select id,jsonb_build_object('age_categories',age_categories,'age_confidence',age_confidence,'uci_class',uci_class),
array['age_categories','age_confidence','uci_class'],'manual poharmtb 2027 categories 2026-10-29' from changed
on conflict(event_id) do update set fields=event_overrides.fields || excluded.fields,
locked_fields=array(select distinct unnest(event_overrides.locked_fields || excluded.locked_fields)),
updated_by=excluded.updated_by,updated_at=now() returning event_id
)
insert into event_facts(event_id,field,value,source_url,quote,method,version)
select id,'age_categories',to_jsonb(age_categories),'https://www.poharmtb.cz/cross-country',
'Předběžný rozpis 2027: XCO žáci I/II, žákyně I/II, kadeti/kadetky, junioři/juniorky, U23/Elite, masters, experti; XCC junioři/juniorky a U23/Elite. Dětské kategorie nejsou součástí poháru.',
'manual','poharmtb-2027-categories-2026-10-29' from changed;
commit;
