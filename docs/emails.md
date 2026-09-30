# E-maily Let's Race — jak je zapnout v produkci

Aplikace posílá dva druhy e-mailů. Ty první odchází z Vercelu přes Resend, ty druhé posílá Supabase Auth.

| Druh | Kdy odchází | Odkud | Kód |
|---|---|---|---|
| Nové závody ve vaší oblasti | denně 5:45 (cron `/api/cron/alerts`) | Resend | `src/lib/race-alerts-run.ts` |
| Změny u závodů v plánu | denně 5:45 (stejný cron) | Resend | `src/lib/plan-mail-run.ts` |
| Středeční souhrn | středa ráno (cron `/api/cron/digest`) | Resend | `src/lib/plan-mail-run.ts` |
| Potvrzení registrace, obnovení hesla, změna e-mailu | hned po akci uživatele | Supabase Auth | `supabase/templates/*.html` |

Všechny sdílí stejný vzhled: logo, bílou kartu na šedém podkladu, dlaždice s datem a barvou disciplíny a tmavé tlačítko. E-maily z Resendu navíc mají:
- textovou verzi,
- patičku s odkazem na nastavení,
- jednoklikové odhlášení (hlavička `List-Unsubscribe`, RFC 8058), které Gmail a Yahoo u hromadné pošty vyžadují.

Odkaz na odhlášení vede na `/api/email/unsubscribe`. Ten podle podepsaného tokenu vypne jen daný druh e-mailů (jednu hlídanou oblast, změny v plánu, nebo souhrn), bez přihlašování.

---

## 1. Resend (e-maily z aplikace)

1. Založte účet na <https://resend.com> a v **Domains** přidejte `letsrace.cz`.
2. Resend vypíše DNS záznamy. Přidejte je u registrátora domény:
   - **SPF** (`TXT` na subdoméně `send`),
   - **DKIM** (`TXT` `resend._domainkey`),
   - **MX** pro return-path (`send`).

   Počkejte, až je Resend ukáže jako *Verified*.
3. Pokud ještě nemáte **DMARC**, přidejte `TXT` záznam na `_dmarc.letsrace.cz`:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@letsrace.cz
   ```
   Po pár týdnech bez problémů ho zpřísněte na `p=quarantine`.
4. V **API Keys** vytvořte klíč s oprávněním *Sending access* jen pro doménu `letsrace.cz`.
5. Ve Vercelu (Project → Settings → Environment Variables, prostředí *Production*) nastavte:

   | Proměnná | Hodnota |
   |---|---|
   | `RESEND_API_KEY` | klíč z kroku 4 |
   | `RESEND_FROM` | `Let's Race <zavody@letsrace.cz>` (adresa na ověřené doméně) |
   | `RESEND_REPLY_TO` | volitelné, např. `ahoj@letsrace.cz` |
   | `EMAIL_LINK_SECRET` | dlouhý náhodný řetězec, např. `openssl rand -base64 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://letsrace.cz` (musí sedět, jinak odkazy a logo v e-mailech povedou jinam) |
   | `CRON_SECRET` | už máte, bez něj Vercel cron neprojde |

6. Proveďte redeploy, aby se proměnné načetly.

> `EMAIL_LINK_SECRET` po spuštění neměňte. Odkazy na odhlášení v už odeslaných e-mailech by přestaly fungovat.

## 2. Supabase Auth (registrace a hesla)

Supabase dnes posílá přihlašovací e-maily ze svého sdíleného serveru. Ten má limit několika e-mailů za hodinu, generický vzhled a často končí ve spamu. Pro produkci ho přepněte na Resend:

1. Supabase → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*:

   | Pole | Hodnota |
   |---|---|
   | Sender email | `zavody@letsrace.cz` |
   | Sender name | `Let's Race` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | API klíč z Resendu (klidně druhý, jen pro SMTP) |

2. **Authentication → Emails → Templates**. U každé šablony vložte *Subject* ze souboru `supabase/templates/<název>.subject.txt` a *Message body* ze souboru `supabase/templates/<název>.html`:
   - **Confirm signup**: `confirmation`
   - **Reset password**: `recovery`
   - **Magic link**: `magic_link`
   - **Change email address**: `email_change`

   Šablony vybírají jazyk podle `locale` v metadatech uživatele. Aplikace ho ukládá při registraci. Starší účty a přihlášení přes Google dostanou češtinu.
3. **Authentication → URL Configuration**: *Site URL* = `https://letsrace.cz`. Do *Redirect URLs* přidejte `https://letsrace.cz/auth/callback`. Šablony z Site URL skládají odkaz na logo.
4. **Authentication → Rate Limits**: po zapnutí vlastního SMTP zvyšte *Emails sent per hour*, např. na 100.

Lokálně (`supabase start`) se šablony načítají samy z `supabase/config.toml`.

## 3. Ověření

- **Náhled bez odesílání:** přihlaste se do adminu a otevřete
  - `/api/admin/email-preview?kind=alert&l=cs`
  - `/api/admin/email-preview?kind=change&l=cs`
  - `/api/admin/email-preview?kind=digest&l=cs`

  Parametr `&format=text` zobrazí textovou verzi, `l=en|pl|sk` jiný jazyk.
- **Skutečné odeslání:** na produkci si nastavte hlídanou oblast (Objevovat → Vaše oblasti) a ručně spusťte cron:
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" https://letsrace.cz/api/cron/alerts
  ```
  Odpověď vypíše, kolik e-mailů odešlo (`emailed`). Pokud je `0`, zkontrolujte, že je v oblasti nějaký nový závod z posledních 14 dní a že jsou nastavené `RESEND_*` proměnné. Chyby Resendu jsou v runtime logu Vercelu (`resend send failed`).
- **Doručitelnost:** pošlete si e-mail na <https://www.mail-tester.com>. Cíl je 9/10 a víc.
