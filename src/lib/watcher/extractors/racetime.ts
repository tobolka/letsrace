import * as cheerio from 'cheerio';
import type { ParsedEvent } from '@/lib/domain';
import { geocodeFromGazetteer } from '@/lib/geocode';
import { validDate } from '@/lib/catalog/overview-quality';

/** Timing operator's own structured schedule. No model, search API, or inferred entry links. */
export function parseRaceTime(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const cards = $('[data-rt-calendar-event]');
  if (!cards.length) throw new Error('racetime_calendar_structure_missing');
  const events: ParsedEvent[] = [];
  cards.each((_, el) => {
    const card = $(el), sport = card.find('.rt-term-sport').text().trim();
    const name = card.find('h3').text().replace(/\s+/g, ' ').trim();
    // A duathlon may be tagged MTB by the provider; it is not a cycling race.
    if (!/^(MTB|Cestná cyklistika)$/i.test(sport) || /duatlon|triathlon|triatlon/i.test(name)) return;
    const startDate = card.find('time[datetime]').attr('datetime') ?? '';
    const id = card.attr('data-event-id');
    const placeText = card.find('.rt-term-place').text().replace(/\s+/g, ' ').trim();
    if (!id || !name || !validDate(startDate) || !placeText) throw new Error('racetime_cycling_card_incomplete');
    const geo = geocodeFromGazetteer(placeText);
    const link = card.find('h3 a').attr('href');
    const sourceUrl = link ? new URL(link, url).href : url;
    events.push({ externalId: `racetime-${id}`, name, startDate, placeText,
      countryHint: geo?.countryCode || undefined,
      discipline: sport === 'MTB' ? ['mtb'] : /časovk/i.test(name) ? ['tt'] : ['road'],
      sourceUrl, confidence: 0.95,
      // Include the actual time element: the year is explicit machine-readable source data.
      evidence: { quote: $.html(el), sourceUrl: url, method: 'structured_calendar', version: 'racetime-v1' },
    });
  });
  return events;
}
