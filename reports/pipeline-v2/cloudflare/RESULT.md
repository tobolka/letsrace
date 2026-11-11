# Zkouška Cloudflare: web dnes nasadit nejde

11. 11. 2026. Zkusil jsem web sestavit pro Cloudflare Workers adaptérem OpenNext (`@opennextjs/cloudflare` 1.20.16) v oddělené kopii. Nic se nenasazovalo a v účtu Cloudflare jsem nic neměnil.

## Co vyšlo

| Krok | Výsledek |
| --- | --- |
| Instalace adaptéru | Neprošla s Next.js 16.4.2. Adaptér vyžaduje 16.4.5 nebo novější. |
| Sestavení Next.js 16.4.6 | Prošlo: 155 statických stránek, bez chyb. |
| Balík pro Workers | **Selhal.** Web si přes `src/lib/watcher/run.ts` přibaluje čtečky pipeline včetně čtení přes Chrome (`csc-render`), které na Cloudflare neexistuje. |
| Velikost serverové části | 71 MB před zabalením. Limit Workers je 10 MB po kompresi; s kódem pipeline uvnitř se do něj nejspíš nevejde. |
| Middleware | Adaptér hlásí, že middleware v Node.js je na Cloudflare experimentální a neudržované. |

## Co z toho plyne

- Přesun není otázka nastavení, ale práce: nejdřív oddělit kód pipeline od webu (cesty v `/api/cron`, `/api/ops` a administraci, které importují `watcher/run`), povýšit Next.js o opravnou verzi a ověřit middleware.
- Oddělení pipeline od webu dává smysl i bez Cloudflare: web by se sestavoval menší a rychleji.
- **Doporučení: zůstat na Vercelu.** K přesunu se vrátit, jen když CPU zůstane nad 4 hodinami měsíčně i po úpravách z 6. 11., nebo když se Let's Race stane komerčním. Ceny jsou v `docs/pipeline-v2.md`, oddíl „Hosting a ceny“.

## Co jsem nezkoušel

Běh na adrese `workers.dev`, obnovu stránek po značkách, obrázky pro sdílení, přihlášení a skutečnou spotřebu CPU. Bez sestaveného balíku to změřit nejde.
