# Dubai among the races in Czechia, 16 Nov 2026

## What was wrong
Spinneys Dubai 92 Cycle Challenge (2025, 2026 and 2027 editions) stood in the Czech 2027 overview. Their place, "Dubai (United Arab Emirates)", could not be found on the map, and a place whose country the reader did not recognise took the Czech default.

## Changed in the live catalogue
Location `ad8dc206-9ab5-44c3-b6d7-57090e2095b7` set to country AE, Dubai coordinates (those of the existing geocoded "Dubai" location) and time zone Asia/Dubai; its three races were given the same time zone, which issued new public revisions. Log: `applied.log`.

The public races API no longer lists it under Czechia (136 Czech races in 2027). The Czech 2027 page still showed 137 right after the fix; it follows with the next shared-list refresh in the Mac cycle.

## So it does not happen again
`cleanGeocodeQuery` (`src/lib/geocode.ts`) now recognises the UAE, Australia, New Zealand, Argentina, Brazil, Mexico, Colombia, Thailand, Oman and Qatar by name. Those countries are outside coverage, so the reader skips such races instead of filing them under Czechia. Test in `src/lib/__tests__/geocode.test.ts`.

## Not done
- Five other upcoming public races sit on Czech locations that were never placed on the map (Moravskoslezského a Zlínského kraje, Žacléř, Jižní Čechy, LAWI, Atletický stadion Slavkov u Brna). All but LAWI (LAWI Tour, not checked) are plainly Czech places that only lack a map point.
- The hidden 2027 copies of the Dubai race (different dates) were left as they are.
