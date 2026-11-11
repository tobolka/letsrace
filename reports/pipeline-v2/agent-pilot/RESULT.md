# Zkouška agenta nanečisto (první běh: 5 z 33 případů)

11. 11. 2026. Agent dohledává propozice a rozhoduje sporné duplicity. Nic nezapisuje; odpovědi se jen ukládají k přečtení.

## Stav

První běh proběhl 11. 11. 2026 na pěti případech (předplatné Pro, model Sonnet). Nic se nikam nezapsalo. Zbylých 28 případů čeká.

## První běh: 5 případů

| Případ | Odpověď agenta | Citace na stránce (kód) | Moje čtení |
| --- | --- | --- | --- |
| TBC — Prachatice, 15. 11. | našel PDF propozic na webu klubu `cxprachatice.cz` | ano | **správně a nové**: PDF je „9. závod TBC SÉRIE 2026“, datum 15. 11. 2026. Závod měl jen stránku série. |
| Kolová I. liga, 3. kolo, 14. 11. | našel stránku turnaje na `ceskakolova.cz` | ano | **správně a nové**: začátek, hala, pořadatel, ředitel. Závod měl jen odkaz do kalendáře. |
| TBC — Vimperk, 14. 11. | stránka závodu na webu série obsahuje rozpis | ano | **správně, ale nic nového**: je to adresa, kterou už máme jako web závodu. Ukazuje, že rozpis na ní čtečka nevyužila. |
| Vertova: dva závody 28. a 29. 8. | různé závody | ano, obě | **správně**: jiné názvy, jiné ročníky, po sobě jdoucí dny. |
| Schleizer Dreieck: Jedermann a RTF | různé: závod v neděli, vyjížďka v sobotu | **ne** | věrohodné, ale naše čtečka z `radsport-events.de` nedostane žádný text, takže citaci nejde ověřit. Zůstává zadržené. |

- 5 z 5 odpovědí prošlo kontrolou tvaru, 4 z 5 ověřil kód citací na stránce, 0 chyb při mém čtení.
- **Spotřeba:** 100 sekund celkem, 4 až 8 kroků na případ. Nástroj hlásí 0,19 USD (propozice průměrně 0,05, dvojice 0,02). Je to přepočet, ne účet. Kolik to ubralo z limitu předplatného Pro, odsud nevidím; je to vidět v aplikaci Claude v nastavení, v přehledu využití.
- **Odhad denního běhu 20 případů:** zhruba 5 až 7 minut a 0,6 až 1 USD v přepočtu.
- Pět případů je málo na závěr o správnosti. Stačí na to, že cesta funguje a kolik zhruba stojí.

Ověření citací: `node scripts/with-node.cjs tsx scripts/agent-verify.ts --answers=reports/pipeline-v2/agent-pilot/answers`, výsledek v `answers/verified.json`.

## Od 11. 11. večer: agent je Codex

Vlastník rozhodl, že agent nemá spotřebovávat předplatné Claude. Claude se z cyklu nevolá.

- **Definice pro Codex:** `.codex/agents/race-finder.toml`, agent `race-finder`.
- **Přepážka:** `scripts/agent-desk.cjs`. `status` řekne, kolik případů čeká a kolik zbývá z dnešních 20. `next` vydá případy se zadáním. `answer` převezme odpověď, zkontroluje tvar a uloží ji. Jinudy agent nepracuje.
- **Cyklus na Macu každých 6 hodin:** připraví nové případy, ověří citace v odpovědích, které mezitím přišly, a ověřené předá bráně.
- **Do katalogu:** ověřený odkaz na propozice jde jako návrh do brány. Ověřené „různé závody“ uvolní závod zadržený jako možná duplicita. „Stejný závod“, „nevím“ a „zatím nevydáno“ samy nic nemění.
- **První nález v katalogu:** propozice Cyklokrosu Prachatice, s historií (`agent`, `agent-1`) a žádostí o obnovu stránky. Kolová zůstala zadržená (stránka neprošla testem, že jde o cyklistický závod), Vimperk přeskočen (je to adresa, kterou už máme jako web).
- **Neověřeno:** jestli Codex v jeho prostředí smí číst a psát do složky dat mimo projekt. Pokud ne, požádá o povolení.

## Co je připravené

- **Případy:** `cases/`, 20 závodů bez propozic v příštích 60 dnech (16 českých) a 13 sporných dvojic z 41 závodů, které cyklus zadržel jako „možná už v katalogu je“. Staví je `scripts/agent-cases.ts` z kopie katalogu na Macu. Dvojici vybírá stejný test, kterým ji cyklus zadržel.
- **Zadání a kontrola odpovědí:** `scripts/agent-answer.cjs`. Agent smí číst web, hledat a číst soubor s případem. Odpovídá jedním objektem JSON. Rozhodnutí bez citované stránky se odmítne celé.
- **Spouštění:** `scripts/agent-run.cjs`.

## Stropy

Vynucuje je spouštěč, ne agent.

| Strop | Hodnota | Jak se mění |
| --- | --- | --- |
| Běhů denně | 1 (pražský čas) | `--force` jen ručně |
| Případů na běh | 20 | `--max` |
| Čas na případ | 240 s | `AGENT_CASE_SECONDS` |
| Cena na případ | 0,40 USD | `AGENT_CASE_USD` |
| Cena na běh | 4 USD | `AGENT_RUN_USD` |
| Model | sonnet | `AGENT_MODEL` |

- Den se započítá hned při startu, takže pád uprostřed nevede k druhému běhu.
- Zodpovězený případ se už znovu neptá.
- Běh se zastaví při první známce, že agent nemůže pracovat: není přihlášený, nebo došel limit.
- Cena v dolarech je údaj, který hlásí sám nástroj. U předplatného je to přepočet spotřeby, ne účet; kolik to ubere z limitu předplatného, ukáže až první běh.
- Jiný nástroj (například Codex) se zapojí přes `AGENT_CMD`.

Ověřeno testem s náhradním příkazem: `node scripts/test-agent-run.cjs`.

## První běh po přihlášení

```bash
node scripts/agent-run.cjs --cases=reports/pipeline-v2/agent-pilot/cases --out=reports/pipeline-v2/agent-pilot/answers --max=5
```

Pět případů, pak přečíst spotřebu a odpovědi. Zbytek až podle toho.

## Co ještě chybí

- Ověřené odpovědi poslat jako návrhy do brány (čeká na migrace na produkci).
- Ověření stránek, které naše čtečka nepřečte (například `radsport-events.de`).
- Zapojení do cyklu na Macu jako denní krok.
- Úlohy „najít chybějící závody“ a „opravit čtečku“.

## 11. 11. večer: první odpovědi Codexu a nové druhy případů

Codex odpověděl na 15 případů (s pěti od Claude je to dnešních 20).

| | Počet |
| --- | --- |
| Propozice nalezeny, citace ověřená kódem | 12 |
| Dvojice „různé závody“, citace ověřené | 3 |
| Dvojice „různé závody“, citace neověřené | 2 |
| „Nevím“ | 3 |

Co se s tím stalo:

- **5 odkazů na propozice je v katalogu** přes bránu (Prachatice, třikrát Středeční dráhový pohár, Žabácký cyklokros).
- **4 nálezy zůstaly zadržené**: citace neuvádí datum závodu, takže kód neumí potvrdit, že dokument patří tomuto závodu. Zadání teď žádá citaci s datem.
- **2 přeskočeny**: je to adresa, kterou už máme jako web závodu.
- **3 ověřené „různé závody“ uvolnily zadržené závody**: další průchod odeslal 5 nových závodů a zadržených jako možná duplicita je 36 místo 41.

Úprava brány pro agenta: série uvádí termíny všech kol na jednom řádku („11. 11., 18. 11., 25. 11. … 2026“). Takovou citaci teď kód čte jako datum jednoho kola, pokud je v ní i rok a dokument závod nebo místo jmenuje.

Ruční čtení odpovědí Codexu jsem udělal jen u čtyř přijatých a čtyř zadržených nálezů, ne u všech dvaceti.

Nové druhy případů, které Codex dostane od dalšího dne:

| Druh | Odkud | Co se stane s ověřenou odpovědí |
| --- | --- | --- |
| Vyjížďka, nebo závod | 48 závodů zadržených kvůli označení zdroje | „závod“ uvolní zadržení |
| Termín dalšího ročníku | 314 závodů, jejichž web zmiňuje rok 2027 bez data | zapíše se mezi posouzené termíny; nový ročník zakládá stávající kontrola. **Omezení:** uplatní se jen termín ze stránky, kterou kontrola pořadatelů čte |
| Chybějící závody v kalendáři | 40 aktivních kalendářů a svazů | uloží se jako kandidáti k posouzení; nic se nezveřejní |
| Duplicita uvnitř katalogu | dvojice, které pravidla nerozhodla | „různé“ se zapíše, aby se neptalo znovu; „stejné“ se sloučí, jen když jsou citované stránky obou závodů a názvy to nevylučují. Sloučení jde vrátit |

Neuděláno: závody bez budoucího data (61) a bez použitelného místa (15). První skupina jsou starší závody nalezené pozdě a agent u nich nemá co hledat; druhá by potřebovala zápis místa do kopie katalogu.
