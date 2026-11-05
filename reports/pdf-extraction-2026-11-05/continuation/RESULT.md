# Kontrola předání a pokračování · 5. listopadu 2026

## Výsledek

Rozpracované změny zůstaly zachované. Navázal jsem na „Další krok“ opravami ověřování údajů a rozšířil kontrolu na Claudovy změny čtení dokumentů a důležité návaznosti místního běhu. Přepsal jsem hlavní priority v `docs/operations-progress.md`. Žádný produkční zápis, instalace běhového prostředí, commit ani nasazení neproběhly. Další placená AI neběžela.

Výchozí neuložené změny jsou zachované také jako `inherited-changes.patch`; původní plán jako `operations-progress-before.md`. Původní JSON odpovědi, OCR výsledky, předání a cizí rozpracované soubory se neměnily.

## Opravy podle šesti bodů předání

1. **`no_quote`: skutečná příčina zjištěná.** U 11 z 15 návrhů překračovala doslovná citace nebo identifikační pasáž limit délky. Jeden PDF řádek měl 12 927 znaků. Citace se nyní ověřují celé, do uloženého výsledku jde omezený doslovný výřez. Zbývající čtyři návrhy mají skutečně neplatné odkazy na řádky/prázdné citace a zůstávají odmítnuté. Nešlo obecně o `null` v identifikaci.
2. **Identita stránky:** přesně odkazovaná stránka může uvádět termín i za dlouhým úvodem. Slova názvu se poznají i ve spojeném názvu v konkrétní URL. Obecné povolení celé domény jsem nezavedl: sdílený web seriálu nemůže dokazovat každý jeho závod. Kontrola mnoha různých termínů zůstává. Stabilní údaje z Maštalí se mohou přijmout s citací propozic 2026 jako `year_neutral`; nejsou tím potvrzené propozice 2027 (viz omezení níže).
3. **Hodnoty:** desetinné částky ve formě textu se převádějí na čísla, prázdné/nevyplněné volitelné odkazy se vynechávají, obecná poloha `area/locality` se ukládá jako obec. Neplatný jednotlivý řádek nevyřadí ostatní. Zbývající dva `bad_value` jsou programy bez jediného doloženého času.
4. **Podpora hodnot:** datum slovem a se spojovníky, čas přilepený k textu, metry a tisícové oddělovače. Ponechána kontrola povrchu a zákaz vydávat délku okruhu za délku celého závodu. Pořadatel musí být doložený svou citací; nedoplňuje se z libovolné jiné části dokumentu ani automaticky z „Kontakt“. Řádky z cizího dokumentu nesmějí obejít identitu hlavní citace. Nedoložená půlnoc a časová rozmezí se nepřijímají jako přesný start. Výslovně doložená půlnoc zůstává možná.
5. **Ročník:** rozpoznání obou roků sezony `2026/27` a `2026-27`, včetně roku ve jménu typu `Regulamin_GKKiP_2027`. Stále to nenahrazuje prokázání vztahu konkrétního údaje k danému ročníku. Starý program, poplatek označený jako bez určení ročníku a rozporné datum se nepovyšují automaticky na aktuální údaj.
6. **Ceny:** „ceny startovného“ neblokují doložené startovné. Peněžní ceny, divácké vstupenky a vratné zálohy se odmítají. Prompt také výslovně zakazuje vymýšlet půlnoc a považovat certifikační organizace za místní pořadatele.

Čtečka má novou verzi `practical-v6`, aby uložené předchozí výsledky nebránily novému vyhodnocení.

## Bezplatné přehrání stejných odpovědí

36 závodů, celkem 121 navržených skupin údajů. Jedna skupina programu nebo startovného může obsahovat více řádků.

| Pole | Původně přijato / odmítnuto | Nyní přijato / odmítnuto |
| --- | --- | --- |
| Místo | 15 / 7 | 21 / 1 |
| Pořadatel | 13 / 17 | 17 / 13 |
| Program | 11 / 19 | 15 / 15 |
| Startovné | 9 / 13 | 11 / 11 |
| Trasy | 3 / 14 | 5 / 12 |
| Celkem | **51 / 70** | **69 / 52** |

Původní důvody odmítnutí: 15 `no_quote`, 22 `values_not_supported`, 8 `bad_value`, 21 `not_about_this_race`, 4 `not_this_edition`. Nyní: 4, 31, 2, 11, 4. Růst `values_not_supported` zahrnuje dříve chybně přijaté informace i návrhy, které nově projdou prvními kontrolami, ale nemají doloženou hodnotu. Vyšší počet přijetí tedy není sám o sobě měřítkem správnosti.

Původní sada 12 závodů: nyní **30 přijatých a 13 odmítnutých** skupin oproti 31/12 uvedeným v předání. Zpřísnění kontrol nemusí zvyšovat počet přijetí každé sady.

Podklady: `before.log`, `after.log`, `original-twelve.log` a úplné přehrané výstupy `replay-practical-ai*.json`. Kontext závodu se četl pouze z místní DB na portu 54329. Na vzdálený katalog se nesahalo.

## Ruční kontrola výběru citací

Výběr 18 přijatých skupin vznikl se seedem 20261105 po prvních opravách (před posledním zpřísněním pořadatele). Porovnal jsem hodnoty s uloženými zdrojovými pasážemi a dostupným kontextem. Není to kontrola živých aktuálních dokumentů ani nezávislé měření celé extrakce; stejná sada už slouží k ladění.

| Vybraná skupina | Zjištění |
| --- | --- |
| Donkey Creek – pořadatel a místo | Jméno, role pořadatele a adresa jsou v dlouhém doslovném textu. |
| PGR Poland Gravel Race – místo | Místo je v citaci, ale katalogový začátek 31. 7. 2027 se liší od uvedeného startu 7. 8. 2027. **Rozpor k vyřešení; samotné přijetí místa jej neřeší.** |
| Czech National Championship Park & Flatland – pořadatel | Citace zve na jiné srpnové Forum CFBA, zatímco kontext závodu je listopadový. **Chybné přijetí, po zpřísnění odmítnuto.** |
| Gravelowy Mikołaj – trasa a startovné | 50 km i tři doložené cenové podmínky jsou v citacích. |
| Epic Gran Canaria – startovné a program | Junior 75 EUR a dva doložené etapové starty; časové rozmezí výdeje čísel se již nevydává za přesný čas. |
| Cyclocross de la Riviera – místo a program | Stadion i časy kategorií odpovídají citacím, časy `08h30` apod. se neztrácejí. |
| Road Stage Orlické hory – místo a program | Start/cíl a přesné časy Stage jsou v textu; rozmezí kanceláře se neukládá jako přesný start. |
| ProTour Wyścig 5 / Skwierzyna – pořadatel a program | Klub i přesné starty odpovídají pasážím; rozmezí registrace a tréninku se neukládají jako přesný start. |
| Superprestige Niel – pořadatel | Citace odkazuje pouze na místní organizaci, jméno Flanders Classics pochází z jiné části stránky. **Nedostatečná opora, nyní odmítnuto.** |
| Sensor Cyklo Maštale – pořadatel | Jméno je v propozicích 2026. Stabilní historický podklad, **ne nové potvrzení 2027**. Před automatickým doručením dořešit označení původu z minulého ročníku. |
| STEVENS-CUP Kiel – místo | Citace dokládá město, ne přesný areál; ukládá se jen obec. |
| Rad am Ring – pořadatel | Výslovně uvedeno, že akci organizuje eventwerkstatt GmbH. |

Z toho 14 skupin má oporu ve vybraných pasážích, dvě vedly k další opravě, jedna ukazuje rozpor data a jedna historický původ. **Neuvádět z toho procento přesnosti.**

Další konkrétní rozpor: Grudziądz má v místním kontextu 26.–27. 6. 2027, zatímco uložené řády uvádějí pro toto kolo 5.–6. 6. 2027. Záznam nebyl upraven.

## Kontrola Claudových změn

Prošel jsem neuložené změny všech sedmi původních souborů, historii od `e744fe0f` a kritické návaznosti plánovače, izolovaného čtení, kontroly nových závodů, doplňování a odesílání. Nešlo o kompletní nezávislý audit všech 59 souborů v tomto rozsahu commitů ani ověření jejich produkčních výsledků.

Opraveno navíc:

- Neúspěšné nebo prázdné rozpoznání PDF/obrázku se nesmí trvale uložit jako hotové. Poškozená uložená položka se zkouší znovu. Změna verze uložených OCR výsledků oddělí staré čtení.
- Neúspěšná příprava rozpoznávače se může znovu zkusit; odmítnutý příslib neblokuje všechny další pokusy procesu.
- Kratší použitelný rozpoznaný text nahradí delší rozbitý text PDF. Pouhá délka nebyla vhodné kritérium.
- Vykreslení PDF respektuje otočení stránky.
- Citace organizátora a řádků z dalších dokumentů mají výše uvedené dodatečné kontroly. Původní kontrola povrchu trasy je zachovaná.

Ověřeno znovu: dříve prázdné Topoľčianky se skutečně přečetly – **449 znaků, program i termíny 24./25. 10.** Obsah má viditelné OCR chyby; není tím potvrzeno datum nebo totožnost celého katalogového záznamu. Výstup `topolcianky-ocr.json`.

Důležité omezení návaznosti: `local-fills.cjs` posílá `practical_details` jen pokud je celé pole prázdné i ve výchozí kopii a na cíli. Závodu s již uloženým místem tím nepřibude třeba chybějící program. Před zapojením nové extrakce je třeba navrhnout doplnění jednotlivých chybějících částí se zachováním ručních zámků a kontroly souběžných změn. Pravidlo jsem bez tohoto ověření nerozvolňoval.

## Kontroly

- **1 708 testů / 244 souborů prošlo**, včetně nových regresí dat, citací, poplatků, zdrojů řádků a OCR.
- Kontrola typů prošla; cílený lint bez varování a chyb; `git diff --check` prošel.
- Samostatné zkoušky `test-local-cycle.cjs`, `test-local-guard.cjs`, `test-local-runner.cjs`, `test-monitor-overview.cjs` prošly. Kontrolují souběh, zastavení před odesláním, ochranu přístupů a pravdivé stavy panelu; nejsou zkouškou nové produkční dávky.
- Swift se zkompiloval a běžel na uloženém skenu. Rotace je opravená ve vykreslení; samostatný živý test otočené stránky neproběhl.
- Build veřejné aplikace, skutečné spuštění z instalovaného plánovače a nové síťové čtení katalogu se v této kontrole nedělaly.

## Následující konkrétní práce

1. Dokončit nezávislý seznam očekávaných údajů, ověřit zbývající odmítnutí a přijaté údaje; vyřešit zmíněné rozpory termínů a historický původ. Změny algoritmu posuzovat podle zlepšení správnosti i úplnosti, nikoli počtu přijatých polí.
2. Ověřit částečné doplňování již existujících `practical_details`, časové limity OCR a běh rozpoznávače ve skutečném soukromém prostředí Macu.
3. Připravit zapojení strukturovaného doplňování do stejného cyklu, s přístupem AI jen v tomto kroku a se stávajícím sdíleným rozpočtem. Až potom instalace; bez ní nové opravy na pozadí neběží.
4. Navázat hledáním chybějících propozic a kontrolou duplicit podle nových priorit v hlavním seznamu. Docling zatím nebyl srovnán ani nasazen.

Nové poznámky „Co je nového“ se nepřidávaly: změna je v interním čtení a kontrole dat a zatím ani nešla do provozu.
