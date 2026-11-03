# Dokončení zápisu posouzeného kandidáta — 3. listopadu 2026

## Opravená příčina

Původní `review-discovery-candidates.ts` samostatně označoval kandidáta jako `publishing`, volal více zápisů a následně potvrzoval `published`. Přerušení zanechalo nejasný výsledek a skript opakování zakazoval. Konečné potvrzení navíc nekontrolovalo počet skutečně změněných řádků.

## Provedená změna

- Soukromé funkce `pipeline_claim_candidate`, `pipeline_publish_candidate`, `pipeline_retry_candidate`, pouze pro `service_role`, `security invoker`.
- Převzetí na pět minut, vazba na nezměněný podklad a explicitní rozhodnutí včetně cílové identity. Aktivní převzetí nelze ukrást; po expiraci nový token zneplatní starý.
- Nový i existující závod, plánované místo, hlavní/vedlejší vazby, zdroj, snímek, kontrolní otisk čtení, kategorie a konečný stav kandidáta se ukládají společně. Existující závod používá původní kontrolu revize a ručních zámků; zdroj nelze převést z jiného závodu.
- Potvrzený výsledek se ukládá. Opakování po ztrátě odpovědi vrací stejný výsledek bez dalšího zápisu.
- Po zachyceném selhání další pokus nejdříve za hodinu. Pravidelný bezplatný běh zpracuje nejvýše tři expirované, již schválené publikace. Znovu kontroluje původní zdroj a identitu; nové schválení nevytváří. Finanční limity se nemění.
- Staré `publishing` bez tokenu se automaticky neopakují, protože nelze bezpečně předpokládat, co původní vícečetný zápis dokončil.

## Ověření

- SQL test skutečných migrací: chyba při posledním potvrzení vrací všechny předchozí změny nového i existujícího závodu; expirace/převzetí, odmítnutí starého tokenu, opakování potvrzení, zámek kategorií, nesprávný podklad, obnovení a odmítnutí veřejných rolí.
- 1 487 testů / 229 souborů prošlo; kontrola typů, cílený lint a produkční sestavení prošly.
- Migrace `20261103202930_atomic_candidate_publication.sql` aplikována na produkční databázi.
- Skutečný transakční test v produkční databázi vytvořil a upravil pouze dočasný testovací závod, ověřil potvrzení i opakování a vše vrátil zpět. Žádný testovací závod, místo, zdroj ani kandidát nebyl potvrzen do databáze. První pokus testovacího scénáře postrádal povinný `geocode_status`; skončil úplným rollbackem. Opravený scénář s úplným plánem místa prošel.
- Skutečný `--resume --apply` vrátil prázdný seznam: při kontrole nebyl žádný `publishing`, 11 `pending`, 19 `waiting`, 34 `published`, 161 `rejected`. Tyto počty nejsou metrika správnosti ani nově nalezených závodů.
- Soukromý runtime na Macu aktualizován během nečinnosti sběrače.

## Omezení a návrat

Příprava metadat seriálů stále probíhá před transakcí. Oznámení změn uživatelských plánů zůstávají následný samostatný krok. Ostatní přímí zapisovači mimo posouzené kandidáty nejsou tímto sjednoceni. Automatické posuzování nových kandidátů a nezávislé měření kvality nejsou hotové.

Při problému lze vypnout nový krok `--resume` v pravidelném běhu. Migrace je přídavná; sloupce a potvrzení je třeba zachovat. Nevracet starý publikační skript během aktivních převzetí a nepřevádět `publishing` ručně na `pending` bez kontroly zapsaných dat.
