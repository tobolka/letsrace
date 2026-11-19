# První implementovaný krok

Nasazeno na produkci a nainstalováno do místního panelu. Commit fc361bc2.

Serverová odpověď, uložený výsledek a místní souhrn používají stejná pravidla pro skutečná selhání, limity čteček a odloženou práci. Selhané zápisy se neztratí ani při nesprávném úspěšném příznaku čtečky. Omezení čteček samo nespouští hlášení zvýšené poruchovosti. Panel ukazuje počty omezených i odložených čtení také u serverového běhu.

Živý kontrolní běh: 60 zdrojů, 0 skutečných selhání, 39 potřebuje jinou čtečku, 0 odloženo. Serverový výsledek i jeho uložená podoba se shodují; stav je limited. Omezení se nezaměňuje za úplné přečtení.

Ověření: 1 282 testů ve 188 souborech, TypeScript, kontrola změněných zdrojů, produkční sestavení a sestavení/podpis panelu. Živý běh se spustil bez upozornění ostatním a bez placené AI. Finanční limity se neměnily.
