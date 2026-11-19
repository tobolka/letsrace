# Audit přiřazení českých MTB závodů k seriálům
Datum: 29. 10. 2026. Rozsah: 54 veřejných nesloučených databázových záznamů s českým místem a MTB disciplínou v období 29. 10. 2026–29. 10. 2027. Veřejný web může některé záznamy dále filtrovat podle druhu akce; počet databázových záznamů není slibem stejného počtu viditelných závodů.

Prověřeno přiřazení již existujících závodů, nikoliv úplnost všech českých kalendářů. Nevytvářely se nové závody.

## Provedené změny
- Český pohár MTBO: vytvořen seriál a připojeno šest existujících českých víkendů. Zdroj: [oficiální kalendář ČSOS 2027](https://mtbo.ceskyorientak.cz/vyberove-rizeni-na-poradatele-cp-mtbo-2027-je-u-konce/). Rakouský víkend nebyl v kontrolovaných záznamech; nový závod se nevytvářel. ME Hradec Králové nebylo do českého poháru přiřazeno, protože je ve zdroji samostatnou soutěží.
- MTB král Hostýnek: vytvořen seriál; připojena Rohálovská 50ka a Rusavská 50ka. [Propozice Rohálovské 50ky 2027](https://www.vesani.cz/propozice/) výslovně potvrzují aktivní seriál a odkazují na [pravidla se seznamem členských závodů](https://www.vesani.cz/mtb-kral-hostynek/). Pravidla nemají samostatný ročníkový kalendář 2027; Rusavská má potvrzený termín 2027 a je jmenována v těchto pravidlech.
- UltraBikers Cup: vytvořen seriál; připojena Moravia Divide. Z téhož [oficiálního kalendáře 2027](https://ultrabikers.eu/calendar-2027/) ověřeny a připojeny také existující gravelové Race Across Czechia a UB30 / UB20: Seven Wineyards Challenge.
- Celkem tři nové seriály, 11 doplněných vazeb, z toho devět v původním MTB souboru a dvě související gravelové akce. Připojení chráněno ručním přepsáním series_id; evidence uložena do event_facts. Zachována ID závodů, názvy, termíny i ostatní klasifikace.

## Neprovedená a nejistá přiřazení
- HIGH POINT Galaxy MTB maraton: oficiální web jmenuje Galaxy sérii a Auto Vinkler jihočeský MTB pohár výslovně pro 2026; novinka pořadatele potvrzuje datum 21. 8. 2027, ale zatím ne příslušnost k seriálům 2027. Automaticky nepřiřazeno.
- Malevil Cup: současný web uvádí Author Marathon Tour 2026. Členství v Author Maraton Tour nebo MarathonMan Europe pro 2027 neověřeno, žádné další členství nepřidáno.
- JuniorCup a Decathlon Cyklomaraton: zdroje 2027 popisují jednotlivé každoroční akce. Samotný název „Cup“ ani shoda s existujícím záznamem značky nejsou důkazem vícedílného seriálu. Nevytvářela se další karta seriálu.
- May Divide, Trojmezí, Bike Paradise, Půl Paradise: společný pořadatel nepotvrzuje společné seriálové bodování, nepřiřazeno.
- U ostatních nezařazených závodů nebyla v prohlédnutých zdrojích doložena příslušnost k seriálu 2027. To neprokazuje, že do žádného seriálu nepatří.
- Pro Soběšickou Muldu/Muldičku zdroj nyní stále ukazuje ročník 2026; datum 2027 nebylo v tomto auditu měněno.
- Existující jednorázové značkové karty AUTHOR Král Šumavy a Malevil Cup zůstaly zachovány; audit neprováděl přestavbu stávajícího modelu seriálů.

## Ověření
Po zápisu: ČP MTBO 6 veřejných závodů, MTB král Hostýnek 2, UltraBikers Cup 3; každý s primárním členstvím a chráněným series_id. Po ověření cílového projektu obnovena produkční CDN a datová cache. Český MTB přehled vrací odkazy na všechny tři nové seriály.

Soubory: catalogue-before.json, before-updates.json a related-events-before.json obsahují původní stav; updates.sql provedenou transakci; review.json rozhodnutí pro každý z 54 záznamů; source-checks.json výsledky kontroly zdrojů; verification.json závěrečnou databázovou kontrolu.

