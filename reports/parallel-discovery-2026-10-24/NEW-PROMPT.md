# Nové zadání pro vyhledávání závodů

Stav: zapojeno místně pro OpenAI i Sonnet. Jeden nový běh OpenAI dokončen: [výsledky](prompt-v2/REPORT.md). Výsledky staršího pilotu vznikly s předchozím zadáním.

Najdi co nejvíce cyklistických závodů konaných v České republice v roce 2027.

Zahrň silnici, MTB (XC, XCM, enduro, downhill), gravel, cyklokros, ultra, BMX a dětské závody. Hledej také menší regionální akce a jednotlivá kola závodních seriálů.

Přísná pravidla:
- Pouze skutečné cyklistické závody. Vyluč běh, triatlon, duatlon, turistiku, multisportovní a nezávodní akce.
- Zařazuj pouze závody s doloženým ročníkem 2027. Neodhaduj termíny podle minulých let.
- Preferuj oficiální kalendáře, weby pořadatelů a závodních seriálů.
- Odstraň duplicity. Každé kolo seriálu uveď samostatně. Různé délky tratí jednoho závodu automaticky nerozděluj na samostatné závody.
- Neověřené informace nevymýšlej. Neodhaduj město, kraj ani přítomnost dětských závodů.
- Datum nemusí být uvedené ve větě. Stačí samotné datum v tabulce, nadpisu nebo na plakátu, pokud ze zdroje jasně plyne, ke kterému závodu a ročníku patří.
- confirmed = zdroj jednoznačně potvrzuje termín závodu; preliminary = zdroj označuje termín jako předběžný; date_unknown = ročník 2027 je výslovně oznámený, ale přesný den zatím není doložený. Samotná existence minulého ročníku nestačí pro date_unknown.
- children: yes / no / unknown. Neuvedená informace znamená unknown. Doprovodný dětský program není dětský závod; samostatný dětský závod může mít vlastní řádek.
- Každý závod musí mít source_url ze skutečně nalezeného zdroje. Samotný název v paměti modelu nestačí.

Výstup: jeden přehled se sloupci date, start_date, end_date, name, city, region, discipline, series, children, status, source_url. Pro předání do fronty ho vrať jako JSON podle systémového formátu.
date zachovává znění data ze zdroje (případně jen měsíc); start_date a end_date jsou YYYY-MM-DD, pokud je přesný den doložený, jinak null. U jednodenního závodu je end_date null. Neznámé město, kraj a seriál mají hodnotu null.
Seřaď chronologicky; položky bez přesného data dej na konec. Vrať pouze výsledky bez dlouhých komentářů.

Optimalizuj vyhledávání: Nejprve projdi kalendáře pořadatelů, federací a seriálů. Potom cíleně doplňuj méně pokryté disciplíny a kraje. Souhrnný kalendář použij k objevení závodu; pokud neprokazuje ročník nebo termín jednoznačně, otevři pořadatelský zdroj. Jakmile máš potřebný důkaz, další ověřování stejného závodu ukonči.
