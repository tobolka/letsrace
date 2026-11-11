# Zkouška Cloudflare: web se pro Workers sestaví

11. 11. 2026, druhé kolo. Web jsem sestavil pro Cloudflare Workers adaptérem OpenNext (`@opennextjs/cloudflare`). Nic se nenasadilo a v účtu Cloudflare jsem nic neměnil.

## Co vyšlo

| Krok | Výsledek |
| --- | --- |
| Next.js | Adaptér vyžaduje 16.4.5 nebo novější. S 16.4.6 se web sestavil bez chyb (155 statických stránek). |
| Balík pro Workers | **Prošel** po opravě jednoho importu: čtení přes Chrome se v `csc.ts` načítalo způsobem, který adaptér neuměl zabalit. Oprava je na `main`. |
| Velikost | 29,6 MB, po kompresi **7,2 MB**. Limit placeného tarifu je 10 MB, bezplatného 3 MB. Vejde se tedy jen do placeného (5 USD měsíčně). |
| Zkouška nasazení nanečisto | `wrangler deploy --dry-run` prošel. |
| Middleware | Adaptér hlásí, že middleware v Node.js je na Cloudflare experimentální. Neověřeno za běhu. |

První pokus ten den selhal, protože jsem zkoušel původní kód s Next.js 16.4.2. Tvrzení z první verze tohoto souboru, že web „nasadit nejde“, tím neplatí.

Nastavení zkoušky je ve větvi `cloudflare-trial` (Next.js 16.4.6, `wrangler.jsonc`, `open-next.config.ts`). Na `main` Next.js povýšený není.

## Co ještě nevíme

Tohle ukáže až skutečné nasazení na zkušební adresu `workers.dev`:

- jestli funguje middleware, přihlášení, mapa a obrázky pro sdílení,
- kolik CPU stojí jedna stránka závodu,
- jak se chová mezipaměť stránek. Zkušební nastavení žádnou sdílenou nemá; pro ostrý provoz je potřeba úložiště R2 a ověřit obnovu stránek po značkách,
- jak přenést pět plánovaných úloh z `vercel.json` (Cloudflare má vlastní plánovač).

Rezerva velikosti je malá (7,2 z 10 MB). Oddělení kódu pipeline od webu by ji zvětšilo; samo o sobě ale nasazení neblokuje.

## Co je potřeba od vlastníka

1. Přihlášení není potřeba: `wrangler` je na Macu přihlášený k účtu Tobolka Account.
2. V Cloudflare zapnout Workers Paid (5 USD měsíčně). Bez něj se balík nenahraje.
3. Tajné klíče webu zadat příkazem `wrangler secret put`, stejně jako u GitHubu.

## Srovnání

| | Měsíčně | CPU | Přenos dat |
| --- | --- | --- | --- |
| Vercel Hobby (dnes, přes limit ve třech položkách) | 0 | 4 h; teď 10 h 21 min | 10 GB; teď 18 GB |
| Vercel Pro | 20 USD | víc, další se připlácí | 1 TB |
| Cloudflare Workers Paid | 5 USD | 8,3 h v ceně, další hodina asi 0,07 USD | neúčtuje se |

Při dnešní spotřebě by Cloudflare vyšel zhruba na 5,15 USD měsíčně.
