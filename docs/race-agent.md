# Agent pro nedořešené závody: návrh

Stav k 10. 11. 2026: návrh, nic z toho zatím neběží. Doplňuje [systém doplňování závodů](race-completion-system.md) a s ním se nepřekrývá: čtečky a kontroly zůstávají, jak jsou. Agent dostává jen to, s čím si čtečky neporadí.

## Co dnes zůstává nedořešené (měřeno 10. 11.)

**Zadržené změny.** Poslední cyklus zadržel 775 změn u 137 závodů, protože nezná odpověď:

| Důvod zadržení | Závodů (přibližně) | Kdo to má řešit |
| --- | --- | --- |
| Změna stavu, z toho 89× „proběhl“ → „plánovaný“ | 105 | **pravidlo, ne agent.** Starý ročník se přepisuje místo založení nového, viz [pravidla ročníků](annual-editions.md) |
| Možná už v katalogu je (duplicita) | ~40 | agent |
| Vyjížďka, ne závod (rajd, brevet, přednáška) | ~47 | agent |
| Bez budoucího data | 51 | agent: najde termín, nebo potvrdí, že žádný není |
| Změna názvu | 16 | agent |

**Chybějící údaje** u 327 závodů v příštích 90 dnech: propozice má 64 %, startovné 32 %, tratě 28 %, registraci 34 %, kontakt 43 % a výsledky 6 %.

**Hledání webů** občas přijme zpravodajský článek nebo agregátor (directasport.it, ciclocolor.com) jako web pořadatele. Ručně to dnes nikdo nekontroluje.

**Rozpočet na AI** je hlavní omezení. Za listopad je k 10. 11. utraceno 3,09 USD z měsíčních 5 USD a denně se spotřebuje zhruba 0,5 USD. Limit tak dojde kolem 14. 11. Další placený model by se do něj nevešel.

## Co agent dělá

Jeden agent, tři úlohy, v tomto pořadí podle užitku:

1. **Rozhoduje zadržené případy.** Řeší duplicitu, vyjížďku proti závodu, změnu názvu a chybějící termín. Ke každému rozhodnutí připojí odkaz a doslovnou citaci, ze které vychází.
2. **Dohledává propozice** u závodů v příštích 60 dnech, které čtečky vzdaly. Prochází web, jak by ho procházel člověk: série, svaz, přihlašovací portál, pořadatel. **Vrací jen odkaz na dokument.** Údaje z něj pak vytáhne stávající čtečka (`enrich-practical-details.ts`) se svými kontrolami. Agent tedy hledá a kód čte, stejně jako u modelu podle [plánu dat z modelu](llm-data-plan.md).
3. **Hlásí opakující se vzory.** Když stejný druh rozhodnutí udělá víckrát na jednom webu nebo u jednoho typu chyby, zapíše ho jako kandidáta na pravidlo nebo novou čtečku. Pravidlo pak napíše člověk se session a agent tu práci příště nedostane.

Co agent nedělá: nezapisuje do katalogu, nemění stav ročníku, neodvozuje termín z loňska, nesahá na server a nespouští deploy.

## Jak běží

- **Claude Code v neinteraktivním režimu (`claude -p`) na Macu**, jednou denně v noci jako další krok v `local-cycle.cjs` s pevným časovým limitem. Platí se z předplatného Claude Code, takže API rozpočet 5 USD zůstává čtečkám. Je to stejná práce, kterou dnes dělám v session („nejdřív čti sám, potom placená AI“), jen bez člověka u klávesnice.
- **Má pevně daný seznam povolených nástrojů:** čtení webu, čtení souborů, `scripts/read-race.ts`, čtení místní databáze přes vlastní skript a zápis do vlastní složky. Nic mimo seznam nemá, takže se nemá na co ptát. Tím odpadá problém, na kterém se zasekávaly naplánované sessions.
- **Vstup:** skript připraví frontu, nejvýš 20 případů za noc. Nejdřív zadržené případy, potom závody s nejbližším termínem bez propozic. Ke každému případu přidá, co už víme a co čtečky zkusily.
- **Výstup:** `decisions.jsonl` ve složce dat. Každý řádek obsahuje závod, druh rozhodnutí, hodnotu, URL, citaci a jistotu.
- **Kontrola v kódu před použitím:** skript stránku znovu stáhne a ověří, že citace na ní opravdu je. Ověří taky, že rozhodnutí je jednoho z povolených druhů a že hodnota z citace plyne (stejné kontroly jako u čteček). Co projde, jde stávající cestou pro posouzené odpovědi (`--answers` v `check-next-editions.ts`, u nových závodů `local-review-new.ts`). Co neprojde nebo je nejisté, zůstává zadržené.
- **Vratnost:** každý použitý fakt nese metodu `agent` a verzi zadání. Všechno od agenta jde vrátit jedním příkazem, stejně jako u ostatních metod v `event_facts`.

## Jak poznáme, že funguje

- **Pilot na sucho, týden:** agent rozhoduje 20 případů za noc, nic se nepoužije. Já v session přečtu stejných 20 a porovnám je s jeho rozhodnutími.
- **Zapnutí:** jen pro druhy rozhodnutí, kde pilot nemá chybu. Ostatní zůstávají na sucho.
- **Provoz:** každý týden se náhodný vzorek znovu ověří. Druh rozhodnutí, který má ve vzorku chybu, se sám vypne a cyklus to nahlásí.
- **Měří se:** kolik zadržených závodů ubylo, kolik závodů v příštích 60 dnech má propozice a kolik kandidátů na pravidla se změnilo v kód. Když za dva týdny žádné z těch čísel neporoste, agent se vypne.

## Pořadí stavby

1. Skript na frontu a `decisions.jsonl` s kontrolou citací, včetně testu.
2. Zadání pro agenta a seznam nástrojů. Pilot na sucho na zadržených případech.
3. Používání rozhodnutí přes stávající cestu, druh po druhu.
4. Dohledávání propozic.
5. Týdenní souhrn vzorů.

Samostatně a předem: 89 závodů „proběhl → plánovaný“ je chyba ve čtení ročníků. Opraví se pravidlem, ne agentem.
