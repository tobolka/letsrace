# Prompt pro projekt Albrechta

Implementuj a otestuj přechod z Vercel Analytics na existující vlastní Umami. Pracuj v `/Users/radektobolka/Documents/GitHub/albrechta-dve`, respektuj aktuální AGENTS.md a docs/staging.md. Přečti aktuální Next.js dokumentaci v node_modules/next/dist/docs před změnami. Větev staging je test, master produkce. Změny nejprve commitni a pushni na staging. Produkční release až po ověření; nikdy neposílej testovací poptávky do produkce.

## Existující infrastruktura — nevytvářej druhou instalaci

- Umami 3.4.1, privátní repo https://github.com/tobolka/umami-analytics.
- Vercel projekt tobolkas-projects/umami-analytics, Neon Free/Postgres 17 v EU Frankfurt (wispy-thunder-83472589). Supabase se pro analytiku nepoužívá: dva bezplatné projekty jsou už obsazené.
- Produkční web Albrechta má skutečné website ID `2091cc02-f7b7-4b85-9ab3-e0ec5c4c8d6e`.
- Samostatný testovací web Albrechta STAGING TEST má ID `ef1f32d7-d802-4dc3-bfa7-492299321765`.
- Produkční tracker musí být `https://stats.albrechta.cz/s.js` a collection musí mířit na stejnou subdoménu.
- Doména je ve Vercel projektu přidaná a vlastnictví ověřeno. Vercel požaduje CNAME `stats.albrechta.cz` → `411d5b19cde3e236.vercel-dns-017.com.` (TTL Auto). DNS nesmíš změnit bez výslovného pokynu uživatele. Nejdřív ověř DNS, HTTPS, s.js a /api/send; při původním auditu stats.albrechta.cz ještě nebyla správně nasměrovaná.
- Admin heslo je již náhodné, výchozí přihlášení nefunguje; počáteční přístup leží lokálně pouze v `/Users/radektobolka/Documents/GitHub/umami-analytics/.codex/admin-login.json` (ignorovaný soubor, 0600). Nikdy obsah nevypisuj do chatu ani logů. 2FA šifrovací klíč je nastavený; majitel má změnit heslo a zapnout 2FA.
- Veřejné sdílení a session replays jsou vypnuté. Existuje privátní goal inquiry_complete a funnel booking_start → inquiry_submit → inquiry_complete.

## Skutečné integrační body z auditu

1. `app/[lang]/layout.tsx` importuje a renderuje `Analytics` z `@vercel/analytics/next`. Nahraď jedním root trackerem, zachovej staging guardy.
2. `lib/analytics.ts` už obsahuje `trackInquirySubmit` a `trackStayPickSelect`. Dnešní `trackInquirySubmit` se volá AŽ po úspěchu a odesílá inquiry_submit: při migraci přejmenuj tento potvrzený výsledek na inquiry_complete. Nespoléhej na název současné funkce.
3. Dva skutečné submit handlery jsou v `components/site/apartment-booking-card.tsx` a `components/site/availability-request-form.tsx`. Oba validují, zavolají submitInquiry a při !result.ok vrací false. Inquiry_complete měř pouze po result.ok; inquiry_submit těsně před skutečným submitInquiry po klientské validaci. Nepřidávej stejné události zároveň do sdíleného panelu.
4. `components/booking/booking-inquiry-panel.tsx` má submitLock a čte kontaktní údaje pro vlastní funkčnost. Zachovej je; do analytiky z nich neposílej vůbec nic.
5. Booking_start měř jednou při skutečném zahájení poptávky nebo otevření kontaktního kroku po validaci, ne při každé změně kalendáře.
6. `components/site/home-hero.tsx` má CTA odkaz na sekci dostupnosti. Doplň cta_click s location=home_hero. Pro skutečné mailto/tel odkazy přidej contact_click s method=email/phone, nikdy s adresou nebo číslem. Důležité skutečné externí odkazy měř outbound_click; download_click pouze pro existující soubory.

## Soukromí a prostředí

- Zachovej design, rezervace, SEO, staging ochranu, přepis testovacích e-mailů a hranice staging/public schémat. Neměň databáze rezervací.
- Tracker jen na přesných produkčních hostech a v produkčním prostředí. APP_ENV=staging musí standardně zůstat bez analytiky; pro dočasný test explicitní opt-in + výhradně testovací website ID. Staging Vercel projekt je samostatný a může mít VERCEL_ENV=production: nestačí samotné VERCEL_ENV.
- Umami next/script afterInteractive, jeden root script. Použij data-domains, data-host-url, data-do-not-track, data-exclude-hash a před načtením definovaný data-before-send hook. GPC/DNT blokuj před načtením trackeru.
- Inspirace bezpečným hookem: `/Users/radektobolka/.codex/worktrees/umami-integration/letsrace/src/lib/analytics.ts` a komponentou `src/components/analytics/umami.tsx` ve stejné pracovní kopii. Uprav whitelist cest a eventů pro Albrechtu; nekopíruj beze změny race-specific pravidla.
- Povolit jen veřejné cesty, nikdy admin, auth, guest odkazy, booking tokeny nebo neveřejné URL. Ze query zachovat pouze kontrolované utm_source/medium/campaign; ostatní query/hash odstranit. Referrer externí pouze origin; neveřejné interní cesty zahodit. Neodesílat document.title s osobními údaji.
- Property whitelist: location, source, apartment (veřejný slug), method, lang. Žádná jména, e-maily, telefon, zprávy, přesné termíny, tokeny, guest_count ani stay_nights. Současné stay_nights z analytics wrapperu odeber.
- Ošetři selhání analytiky tak, aby nikdy nepřerušilo formulář ani navigaci. Pozor na duplicitní pageviews při query změnách kalendáře: deduplikuj očištěné URL.
- Pro jednoduché CTA preferuj data-umami-event; logické výsledky měř umami.track(). Starý Vercel sběr a balíček odstraň při přechodu, související env maž jen po ověření, že nejsou sdílené s monitoringem.
- Aktualizuj skutečnou privacy policy ve všech jazycích; neprohlašuj automaticky, že cookieless znamená výjimku ze souhlasu. Zaznamenej potřebu posoudit právní základ a retenci.

## Ověření a předání

Spusť typecheck, lint, build a relevantní testy. Na soukromém stagingu s test ID ověř pageview, SPA a back/forward, UTM/referrer, CTA, validation failure, API failure, úspěšnou poptávku a ochranu před dvojím submit. Poptávka smí pouze do staging schématu a e-mail jen vlastníkovi. Zápis ověř i v Umami/Neon, nikoli jen podle přítomnosti scriptu. Po testu vypni testovací konfiguraci a znovu ověř, že staging nic neměří. Produkci přepni až po DNS a ověřené integraci. Uveď konkrétní commity, odkazy a rozliš implementováno / ověřeno / blokováno. Výchozí snapshot auditu není důkaz aktuálního nasazení.
