import { expect, it } from 'vitest';
import { parseRaceTime } from '@/lib/watcher/extractors/racetime';
import { quoteStatesDate } from '@/lib/catalog/quoted-date';
const url = 'https://racetime.sk/terminovka';
const card = (name: string, sport = 'MTB', date = '2027-01-31') => `<article data-rt-calendar-event data-event-id="162"><time datetime="${date}">31 JAN</time><span class="rt-term-status">Pripravujeme</span><span class="rt-term-sport">${sport}</span><h3>${name}</h3><p class="rt-term-place">Prírodný Amfiteáter Raslavice</p><p>Detail pripravujeme</p></article>`;
it('extracts announced basics from structured data without inventing registration or categories', () => {
 const [race] = parseRaceTime(url, card('Čergovská reťaz 2027'));
 expect(race).toMatchObject({ startDate: '2027-01-31', countryHint: 'SK', discipline: ['mtb'], externalId: 'racetime-162' });
 expect(quoteStatesDate(race.evidence!.quote, race.startDate)).toBe(true);
 expect(race.registrationUrl).toBeUndefined(); expect(race.ageCategories).toBeUndefined();
});
it('rejects running and duathlon even when the operator tags it MTB', () => {
 expect(parseRaceTime(url, card('Beh','Beh') + card('E3NEXUS Cross Duatlon 2027'))).toEqual([]);
});
it('keeps structural failures retryable instead of returning an empty successful calendar', () => {
 expect(() => parseRaceTime(url, '<h1>Unavailable</h1>')).toThrow('structure_missing');
 expect(() => parseRaceTime(url, card('Race', 'MTB', '2027-02-31'))).toThrow('incomplete');
});

it('does not use the shared timing calendar as a duplicate identity across different days', async () => {
 const { isSharedCalendarEvidence, calendarRowCandidates } = await import('@/lib/watcher/source-identity');
 const [race] = parseRaceTime(url, card('Čergovská reťaz 2027'));
 expect(isSharedCalendarEvidence(race)).toBe(true);
 expect(calendarRowCandidates('2027-07-25', isSharedCalendarEvidence(race), [{ event: { startDate: '2027-01-31' } }])).toEqual([]);
});
