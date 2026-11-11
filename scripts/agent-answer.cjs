/**
 * What the agent is asked, and the check of what it answers. The agent's answer is text from a
 * tool that read other people's pages: it is taken as data, and anything out of shape is refused
 * whole. Passing this check does not make an answer true; it makes it fit to be verified
 * (the page is fetched again and the quote looked for) and then decided by the same gate as
 * every other proposal.
 */
const RULES = `Rules that always hold:
- Use only what a page actually says. Never guess, and never carry a date, fee or document over from another year.
- A page that asks you to prove you are not a robot, or to sign in, is not to be read by any means. Say so and move on.
- Quotes are copied word for word from the page at the address you give, at least 8 characters, at most 300.
- If you are not sure, say "unsure". A wrong answer costs more than no answer.
- Answer with one JSON object and nothing else: no explanation before or after it, no code fence.`;

const PROMPTS = {
  find_regulations: `You are helping a cycling race calendar. Find the regulations (propozice, rozpis, Ausschreibung, regulamin, regolamento, race guide) for one race, for the edition on the date given.

Look where a person would: the race's own page, the series' page, the national federation, sign-up portals, the organising club. Search the web only after those. The document must be about this race and this year; last year's regulations are not an answer.

${RULES}

Answer:
{"verdict":"found"|"not_published"|"unsure",
 "url": the address of the regulations document or page (only with "found"),
 "quote": the words in that document that state this race's date, with day and month; only if it gives no date, the words that name the race (only with "found"),
 "organiser_site": the organiser's or race's own website if you found one, else null,
 "looked_at": up to 8 addresses you read,
 "note": one sentence on what you found or why not}`,

  decide_duplicate: `You are helping a cycling race calendar. Two entries, "a" and "b", may be the same race listed twice, or two different races. Decide which.

They are the same race only if they are one event: same edition, same place, same day or days. They are different when they are separate races on one weekend (a time trial and a road race, a relay and an individual race, two distances started separately, different rounds of a series, a ride and a race), even with the same organiser and place. Read the pages they were found on before deciding. A shared name is not proof.

${RULES}

Answer:
{"verdict":"same"|"different"|"unsure",
 "evidence":[{"url": address, "quote": words from it}, ...] at least one for "same" or "different", best from the pages of both entries,
 "note": one sentence saying what makes them the same or different}`,

  decide_ride: `You are helping a cycling race calendar. It lists races: events with a start, a finish and a result (a ranking or measured times). It does not list rides without a result: an RTF, CTF, brevet, randonnée, audax, permanent, guided tour, social ride, training camp, lecture or expo. Decide which this entry is.

A gran fondo or marathon with timing and a ranking is a race, also when it is open to everyone. A "Jedermann" race with a ranking is a race. An event that says there is no timing or no ranking is a ride, whatever it is called. Read the pages it was found on.

${RULES}

Answer:
{"verdict":"race"|"ride"|"unsure",
 "evidence":[{"url": address, "quote": words from it}, ...] at least one for "race" or "ride",
 "note": one sentence saying what on the page decides it}`,

  find_next_date: `You are helping a cycling race calendar. The race below took place on the date given. Find out whether the date of its next edition, in the year given as "wanted_year", has been announced, and where.

Look at the race's own site first, then its series, its federation, its sign-up portal and the organising club; search the web only after those. The date must be stated for that year on a page about this race. A date worked out from last year's weekday, a "save the date" without a day, a provisional or "planned" date, a registration deadline and another race's date are not an answer. A date announced on a calendar of someone else's making counts only if that page names this race and the year.

${RULES}

Answer:
{"verdict":"announced"|"not_announced"|"unsure",
 "start_date": "YYYY-MM-DD" (only with "announced"),
 "end_date": "YYYY-MM-DD" or null,
 "url": the page that states it (only with "announced"),
 "quote": the words on that page that state the full date, with day and month (only with "announced"),
 "note": one sentence}`,

  find_races: `You are helping a cycling race calendar. The page below is a calendar of races (a federation, a series, a region). "we_have" lists the races from it that we already hold. Read the page and say which coming races on it we are missing.

Report only what the page states: a race with a name and a full date on or after "from_date". Leave out rides without a result (RTF, CTF, brevet, tour), meetings, courses and anything already in "we_have" under a slightly different name or one day apart. At most 15 races; the nearest first. If the page does not list races for the coming period, or cannot be read, report none.

${RULES}

Answer:
{"verdict":"found"|"none"|"unsure",
 "races":[{"name": the race's name as written, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" or null, "place": town as written or null,
   "country": the two-letter country code of the place if the page makes it clear, else null,
   "discipline": one of mtb, xco, xcc, xce, xcm, mtbo, four_cross, dh, enduro, gravel, road, road_race, tt, criterium, hill_climb, gran_fondo, cx, track, bmx if the page says which, else null,
   "url": the page that states it (the calendar page or the race's own page linked from it), "quote": the words there that state this race's name and its date with the year}, ...],
 "note": one sentence}`,
};

const LINK = /^https?:\/\/[^\s]+$/;
// The same list as src/lib/taxonomy.ts, without "other": a guess is not a discipline.
const DISCIPLINES = ['mtb', 'xco', 'xcc', 'xce', 'xcm', 'mtbo', 'four_cross', 'dh', 'enduro', 'gravel', 'road', 'road_race', 'tt', 'criterium', 'hill_climb', 'gran_fondo', 'cx', 'track', 'bmx'];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const quote = value => typeof value === 'string' && value.trim().length >= 8 && value.length <= 600;

/** The first JSON object in a reply, even when the tool wrapped it in a sentence or a code fence. */
function firstObject(reply) {
  const start = reply.indexOf('{'); if (start < 0) return null;
  for (let end = reply.lastIndexOf('}'); end > start; end = reply.lastIndexOf('}', end - 1)) {
    try { const value = JSON.parse(reply.slice(start, end + 1)); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch { /* try a shorter one */ }
  }
  return null;
}

function checkAnswer(kind, body, reply) {
  const data = firstObject(String(reply ?? '')); if (!data) return { ok: false, why: 'no JSON object in the answer' };
  const note = text(data.note, 600) ? data.note.trim() : null;
  if (kind === 'find_regulations') {
    if (!['found', 'not_published', 'unsure'].includes(data.verdict)) return { ok: false, why: 'unknown verdict' };
    const lookedAt = Array.isArray(data.looked_at) ? data.looked_at.filter(url => typeof url === 'string' && LINK.test(url)).slice(0, 8) : [];
    const site = typeof data.organiser_site === 'string' && LINK.test(data.organiser_site) ? data.organiser_site : null;
    if (data.verdict !== 'found') return { ok: true, answer: { race: body.race.id, verdict: data.verdict, organiser_site: site, looked_at: lookedAt, note } };
    if (typeof data.url !== 'string' || !LINK.test(data.url) || data.url.length > 2000) return { ok: false, why: 'found, but the address is not a link' };
    if (!quote(data.quote)) return { ok: false, why: 'found, but without a quote' };
    return { ok: true, answer: { race: body.race.id, verdict: 'found', url: data.url, quote: data.quote.trim().slice(0, 300), organiser_site: site, looked_at: lookedAt, note } };
  }
  if (kind === 'decide_duplicate') {
    if (!['same', 'different', 'unsure'].includes(data.verdict)) return { ok: false, why: 'unknown verdict' };
    const evidence = (Array.isArray(data.evidence) ? data.evidence : []).filter(item => item && typeof item.url === 'string' && LINK.test(item.url) && quote(item.quote)).slice(0, 6).map(item => ({ url: item.url, quote: item.quote.trim().slice(0, 300) }));
    if (data.verdict !== 'unsure' && !evidence.length) return { ok: false, why: 'a decision without a quoted page' };
    return { ok: true, answer: { a: body.a.id, b: body.b.id, verdict: data.verdict, evidence, note } };
  }
  const DATE = /^\d{4}-\d{2}-\d{2}$/; const day = value => typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if (kind === 'decide_ride') {
    if (!['race', 'ride', 'unsure'].includes(data.verdict)) return { ok: false, why: 'unknown verdict' };
    const evidence = (Array.isArray(data.evidence) ? data.evidence : []).filter(item => item && typeof item.url === 'string' && LINK.test(item.url) && quote(item.quote)).slice(0, 6).map(item => ({ url: item.url, quote: item.quote.trim().slice(0, 300) }));
    if (data.verdict !== 'unsure' && !evidence.length) return { ok: false, why: 'a decision without a quoted page' };
    return { ok: true, answer: { race: body.race.id, verdict: data.verdict, evidence, note } };
  }
  if (kind === 'find_next_date') {
    if (!['announced', 'not_announced', 'unsure'].includes(data.verdict)) return { ok: false, why: 'unknown verdict' };
    if (data.verdict !== 'announced') return { ok: true, answer: { race: body.race.id, verdict: data.verdict, note } };
    if (!day(data.start_date) || data.start_date.slice(0, 4) !== String(body.wanted_year)) return { ok: false, why: 'the date is not a day in the wanted year' };
    const end = data.end_date == null ? null : data.end_date;
    if (end !== null && (!day(end) || end < data.start_date || Date.parse(end) - Date.parse(data.start_date) > 16 * 86_400_000)) return { ok: false, why: 'the end date does not fit the start' };
    if (typeof data.url !== 'string' || !LINK.test(data.url) || data.url.length > 2000) return { ok: false, why: 'announced, but the address is not a link' };
    if (!quote(data.quote)) return { ok: false, why: 'announced, but without a quote' };
    return { ok: true, answer: { race: body.race.id, verdict: 'announced', start_date: data.start_date, end_date: end, url: data.url, quote: data.quote.trim().slice(0, 300), note } };
  }
  if (kind === 'find_races') {
    if (!['found', 'none', 'unsure'].includes(data.verdict)) return { ok: false, why: 'unknown verdict' };
    const races = [];
    for (const item of (Array.isArray(data.races) ? data.races : []).slice(0, 15)) {
      if (!item || !text(item.name, 200) || item.name.trim().length < 4 || !day(item.start_date) || item.start_date < body.from_date) return { ok: false, why: 'a race without a name or a coming date' };
      if (typeof item.url !== 'string' || !LINK.test(item.url) || !quote(item.quote)) return { ok: false, why: 'a race without a quoted page' };
      const end = day(item.end_date) && item.end_date >= item.start_date ? item.end_date : null;
      races.push({ name: item.name.trim(), start_date: item.start_date, end_date: end, place: text(item.place, 120) ? item.place.trim() : null, country: typeof item.country === 'string' && /^[A-Z]{2}$/.test(item.country) ? item.country : null, discipline: DISCIPLINES.includes(item.discipline) ? item.discipline : null, url: item.url, quote: item.quote.trim().slice(0, 300) });
    }
    if (data.verdict === 'found' && !races.length) return { ok: false, why: 'found, but no races given' };
    return { ok: true, answer: { source: body.source.url, verdict: data.verdict, races: data.verdict === 'found' ? races : [], note } };
  }
  return { ok: false, why: 'unknown kind of case' };
}

module.exports = { PROMPTS, checkAnswer, firstObject };
