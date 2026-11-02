# Obnova čtení zdrojů

## Chotěbuzský kopec

- Systémová čtečka na Macu ověří certifikát tohoto webu, zatímco běžné čtení v Node selhá na řetězci vydavatele. Náhradní čtení zachovává ověřování certifikátu, kontroluje veřejnou adresu při každém přesměrování, připíná ověřenou IP a má časový i velikostní limit. Dřívější možnost vypnout kontrolu certifikátu v náhradní čtečce byla odstraněna.
- Stránka má obecný nadpis klubu a archiv mnoha ročníků. Samostatná čtečka nyní bere pouze výslovnou větu „Datum konání příštího závodu je 8. května 2027“, nikoli první datum v archivu. Nejasné, chybějící nebo nemožné datum nic nevytvoří.
- Skutečný produkční běh načetl jeden závod a použil existující ID `c91245ca-9b22-441b-9310-8cd13fd06f59`; žádný nový závod. Zdroj nyní úspěšný, termín a silniční disciplína zůstaly zachované. [Výsledek opakovaného běhu](chotebuz.json).
- Opravena obecná ochrana: nevyjádřená disciplína neznamená nový odhad místo známé disciplíny a formátu. Shodný údaj se nehlásí jako rozpor. Znovunačtení také nemaže původní označení oficiálního zdroje.
- Při první kontrolní iteraci se označení původu změnilo na obecné `scraped`; opravené zpět na `official` se záznamem změny a následný běh již původ zachoval. Opakovaný skutečný běh: 0 nových, 0 změněných, 0 chyb.

## Eventiv

Veřejné rozhraní mapy nyní odpovídá HTTP 401 „Not authenticated“ a web obsahuje přihlašovací bránu. To není prázdný kalendář. Čtečka po prvním odmítnutí nezahajuje dalších pět požadavků. Poslední známé závody zůstávají zachované a omezení zůstává přiznané. Žádné přihlašování, obcházení přístupu ani nový účet.

## Ověření

1 426 testů ve 218 souborech prošlo, sestavení i kontrola změněného kódu prošly. Testy pokrývají odmítnutý přístup, soukromou adresu po přesměrování či změně DNS, skutečné HTTP stavy, selhání certifikátu, archivy starých ročníků, rozpory termínů a zachování známé disciplíny.

Admin navíc ukazuje čas a počet závodů poslední dokončené kontroly společného seznamu zvlášť od kontrol detailů. Hromadné fronty, automatické posuzování a nezávislé měření nejsou těmito opravami dokončené.
