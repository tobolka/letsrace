begin;
update series set
age_categories=array['u13','u15','u17','youth','junior','u23','elite','amateur','masters'],
age_categories_confirmed_at=now(),
age_categories_note='Kategorie podle předběžného rozpisu 2027 na https://www.poharmtb.cz/cross-country. XCO: žáci/žákyně I a II, kadeti/kadetky, junioři/juniorky, U23/Elite muži i ženy, masters a experti. XCC: junioři/juniorky a U23/Elite muži i ženy. Dětské kategorie nejsou součástí poháru 2027; případné zařazení dětí 9–10 let zatím není potvrzené.',
season='2027',
description='Oficiální Český pohár MTB XCO pro rok 2027: pět víkendů C1 a MČR XCO/XCC v Praze. XCO: žáci a žákyně I/II, kadeti a kadetky, junioři a juniorky, muži a ženy U23/Elite, masters a experti. XCC: junioři, juniorky a muži a ženy U23/Elite. Dětské kategorie nejsou součástí poháru 2027; o případném zařazení dětí 9–10 let pořadatel teprve rozhodne. Časový plán je předběžný; MČR a finále mají mít upravený harmonogram. Všichni účastníci potřebují licenci, přihlášky pouze online předem.',
last_seen_at=now(),updated_at=now()
where slug='cesky-pohar-mtb';
update events set description=replace(description,chr(92)||'n',chr(10)),updated_at=now()
where series_id='f5a31302-4fd7-4128-8abc-c1835e7159df' and season='2027' and merged_into_id is null and position(chr(92)||'n' in description)>0;
commit;
