const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const DAY = 86_400_000;
const caseFile = /^[a-z]+-[0-9a-f]{8}\.json$/;
const json = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
const files = (dir) => {
  try { return fs.readdirSync(dir); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
};
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reasons = ['date_conflict', 'scanned_document', 'edition_missing', 'inaccessible', 'other'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEMP_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const TEMP_ERROR_RE = /\b(?:500|502|503|504|52[0-4])\b|bad gateway|service unavailable|gateway timeout|temporar(?:ily|y) unavailable|dočasn[ěe]\s+nedostup|výpadek|timed?\s*out|timeout|server error/i;
const OTHER_SOURCE_RE = /jiný\s+(?:oficiální\s+)?zdroj|other\s+(?:official\s+)?source|different\s+source|zkusit\s+jiný|missing\s+detail\s+source|chybí\s+zdroj|detail_source_missing|needs_other_source/i;
const ANNOUNCEMENT_CUE_RE = /dokonč|finaliz|zveřejn|oznám|publik|vydá|vyjde|schvál|potvrd|upřesn|check.?after|kalendář|calendar|termínovk|announce|publish|confirm|release|veröffent|bekannt|expected|available/i;

const MONTH_MAP = new Map([
  ['ledna', 1], ['leden', 1], ['januára', 1], ['január', 1], ['january', 1], ['januar', 1], ['jan', 1],
  ['února', 2], ['únor', 2], ['februára', 2], ['február', 2], ['february', 2], ['februar', 2], ['feb', 2],
  ['března', 3], ['březen', 3], ['marca', 3], ['marec', 3], ['march', 3], ['märz', 3], ['maerz', 3], ['mar', 3],
  ['dubna', 4], ['duben', 4], ['apríla', 4], ['apríl', 4], ['april', 4], ['apr', 4],
  ['května', 5], ['květen', 5], ['mája', 5], ['máj', 5], ['may', 5], ['mai', 5],
  ['června', 6], ['červen', 6], ['júna', 6], ['jún', 6], ['june', 6], ['juni', 6], ['jun', 6],
  ['července', 7], ['červenec', 7], ['júla', 7], ['júl', 7], ['july', 7], ['juli', 7], ['jul', 7],
  ['srpna', 8], ['srpen', 8], ['augusta', 8], ['august', 8], ['aug', 8],
  ['září', 9], ['septembra', 9], ['september', 9], ['sept', 9], ['sep', 9],
  ['října', 10], ['říjen', 10], ['októbra', 10], ['október', 10], ['october', 10], ['oktober', 10], ['oct', 10], ['okt', 10],
  ['listopadu', 11], ['listopad', 11], ['novembra', 11], ['november', 11], ['nov', 11],
  ['prosince', 12], ['prosinec', 12], ['decembra', 12], ['december', 12], ['dezember', 12], ['dec', 12], ['dez', 12],
]);

function formatUtcDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function resolveYear(month, day, explicitYear, referenceMs) {
  if (explicitYear) return formatUtcDate(explicitYear, month, day);
  const ref = new Date(Number.isFinite(referenceMs) ? referenceMs : Date.now());
  const refYear = ref.getUTCFullYear();
  const refDay = Date.UTC(refYear, ref.getUTCMonth(), ref.getUTCDate());
  const thisYear = formatUtcDate(refYear, month, day);
  if (thisYear && Date.parse(`${thisYear}T00:00:00Z`) >= refDay) return thisYear;
  return formatUtcDate(refYear + 1, month, day);
}

function parseAnnouncementDate(text, referenceMs = Date.now()) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const matches = [];
  const add = (index, iso) => { if (iso) matches.push({ index, iso }); };

  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(m.index, formatUtcDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?(?!\d)/g)) {
    add(m.index, resolveYear(Number(m[2]), Number(m[1]), m[3] ? Number(m[3]) : null, referenceMs));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.?\s+([A-Za-zÀ-ž]+)(?:\s+(\d{4}))?\b/g)) {
    const month = MONTH_MAP.get(m[2].toLowerCase());
    if (month) add(m.index, resolveYear(month, Number(m[1]), m[3] ? Number(m[3]) : null, referenceMs));
  }
  for (const m of text.matchAll(/\b([A-Za-zÀ-ž]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/g)) {
    const month = MONTH_MAP.get(m[1].toLowerCase());
    if (month) add(m.index, resolveYear(month, Number(m[2]), m[3] ? Number(m[3]) : null, referenceMs));
  }

  if (!matches.length) return null;
  if (matches.length === 1) return matches[0].iso;

  const cue = ANNOUNCEMENT_CUE_RE.exec(text);
  if (cue) {
    const afterCue = matches.filter(item => item.index >= cue.index).sort((a, b) => a.index - b.index);
    if (afterCue.length) return afterCue[0].iso;
  }
  return matches.sort((a, b) => a.index - b.index)[0].iso;
}

function uncertainty(answer) {
  if (reasons.includes(answer?.reason)) return answer.reason;
  const note = answer?.note ?? '';
  if (/sken|image.only|OCR|obrazov/i.test(note)) return 'scanned_document';
  if (/rozpor|odlišn.*termín|neshod|conflict|disagree/i.test(note)) return 'date_conflict';
  if (TEMP_HTTP_STATUS.has(answer?.http_status) || TEMP_ERROR_RE.test(note) || /nedostup|nepřístup|inaccessible|captcha/i.test(note)) return 'inaccessible';
  if (/ročník|loňsk|edition|2027/i.test(note)) return 'edition_missing';
  return 'other';
}

function extractScheduledDate(saved) {
  const answer = saved?.answer ?? saved ?? {};
  const checked = Date.parse(saved?.at);
  const refMs = Number.isFinite(checked) ? checked : Date.now();
  if (typeof answer.check_after === 'string' && ISO_DATE.test(answer.check_after)) {
    const parsed = formatUtcDate(Number(answer.check_after.slice(0, 4)), Number(answer.check_after.slice(5, 7)), Number(answer.check_after.slice(8, 10)));
    if (parsed) return parsed;
  }
  const note = answer.note ?? '';
  if (ANNOUNCEMENT_CUE_RE.test(note)) {
    return parseAnnouncementDate(note, refMs);
  }
  return null;
}

function classifyOutcome(saved, body) {
  const isRecord = Boolean(saved && typeof saved === 'object' && ('answer' in saved || 'kind' in saved));
  const answer = isRecord ? (saved.answer ?? {}) : (saved ?? {});
  const kind = isRecord ? saved.kind : body?.kind;
  const verdict = answer.verdict;
  const reason = verdict === 'unsure' ? uncertainty(answer) : null;
  const note = answer.note ?? '';

  if (answer.outcome === 'temporary_error' || TEMP_HTTP_STATUS.has(answer.http_status) || TEMP_ERROR_RE.test(note)) {
    return 'temporary_error';
  }
  if (answer.outcome === 'needs_other_source' || answer.outcome === 'detail_source_missing' || answer.reason === 'needs_other_source' || answer.needs_other_source === true || OTHER_SOURCE_RE.test(note)) {
    return 'needs_other_source';
  }
  const scheduled = extractScheduledDate(isRecord ? saved : { answer });
  if (scheduled) {
    const checked = Date.parse(saved?.at);
    const scheduledMs = Date.parse(`${scheduled}T00:00:00Z`);
    if (!Number.isFinite(checked) || scheduledMs > checked) return 'announcement_scheduled';
  }
  if (answer.outcome === 'unchanged_calendar') return 'unchanged_calendar';
  if (kind === 'find_next_date' && (verdict === 'not_announced' || reason === 'edition_missing')) {
    return 'unchanged_calendar';
  }
  if (verdict === 'planned') return 'planned';
  if (verdict === 'not_published') return 'not_published';
  if (reason) return reason;
  if (verdict) return verdict;
  return 'other';
}

function caseUrls(body) {
  const raw = [
    body?.race?.website,
    ...(body?.race?.pages_we_read ?? []),
    ...(body?.urls ?? []),
    body?.source?.url,
    body?.link?.url,
  ];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'string') continue;
    let url;
    try { url = new URL(item); url.hash = ''; } catch { continue; }
    if (!seen.has(url.href)) { seen.add(url.href); out.push(url.href); }
  }
  return out;
}

// The ordinary Mac reader supplies these signals. No additional request per race.
function sourceChanges(archive) {
  const changed = new Map();
  if (!archive) return changed;
  const ledger = path.join(archive, 'pages.jsonl');
  if (!fs.existsSync(ledger)) return changed;
  for (const line of fs.readFileSync(ledger, 'utf8').split('\n')) {
    let page;
    try { page = JSON.parse(line); } catch { continue; }
    if (page.asksVerification || page.requestAttempted === false || !page.at || !page.url) continue;
    const previous = changed.get(page.url);
    if (page.error || page.status >= 400) {
      changed.set(page.url, {
        signal: previous?.signal ?? null,
        at: previous?.at ?? 0,
        recoveredAt: previous?.recoveredAt ?? 0,
        failed: true,
      });
      continue;
    }
    // Ignore counters, navigation and decoration. Early wake-up needs a new edition signal;
    // error->200 recovery is tracked separately so transient blips don't wake unchanged calendars.
    const signal = fingerprint([page.dateSignals ?? [], page.structuredEvents ?? [], page.follow ?? []]);
    const atMs = Date.parse(page.at);
    if (!previous) {
      changed.set(page.url, { signal, at: 0, recoveredAt: 0, failed: false });
    } else {
      const contentChanged = previous.signal !== null && previous.signal !== signal;
      const recovered = Boolean(previous.failed);
      changed.set(page.url, {
        signal,
        at: contentChanged ? atMs : (previous.at ?? 0),
        recoveredAt: recovered ? atMs : (previous.recoveredAt ?? 0),
        failed: false,
      });
    }
  }
  return changed;
}

// The previous edition only estimates when another check is useful.
function nextEditionInterval(body, checked) {
  const previous = body?.race?.last_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(previous ?? '')) return 14;
  const season = body.wanted_year ?? Number(previous.slice(0, 4)) + 1;
  const reference = Date.parse(season + previous.slice(4));
  if (!Number.isFinite(reference)) return 14;
  const daysUntil = (reference - checked) / DAY;
  return daysUntil <= 60 ? 7 : daysUntil <= 120 ? 14 : 28;
}

function followup(saved, body, changes, ocr, now = Date.now()) {
  const checked = Date.parse(saved.at);
  if (!Number.isFinite(checked)) return null;
  const verdict = saved.answer?.verdict;
  const reason = verdict === 'unsure' ? uncertainty(saved.answer) : null;
  const lastOutcome = classifyOutcome(saved, body);
  let days;
  if (lastOutcome === 'temporary_error') days = 1;
  else if (saved.kind === 'find_races') days = verdict === 'found' ? 14 : 7;
  else if (verdict === 'not_announced') days = nextEditionInterval(body, checked);
  else if (verdict === 'not_published') {
    const daysUntilRace = (Date.parse(body?.race?.date) - checked) / DAY;
    days = daysUntilRace <= 7 ? 2 : daysUntilRace <= 30 ? 7 : 21;
  } else if (verdict === 'planned') days = 14;
  else if (reason) days = ({ scanned_document: 7, edition_missing: saved.kind === 'find_next_date' ? nextEditionInterval(body, checked) : 7, date_conflict: 3, inaccessible: 14, other: 7 })[reason];
  else if (!verdict) days = 7;
  else return null;

  let due = checked + days * DAY;
  let checkAfter = null;
  let nextCheckReason;
  let nextCheckBy = 'codex';

  if (lastOutcome === 'temporary_error') {
    nextCheckBy = 'mac';
    nextCheckReason = 'temporary_http_error';
  } else if (lastOutcome === 'unchanged_calendar') {
    nextCheckBy = 'mac';
    nextCheckReason = 'calendar_still_previous_year';
  } else if (lastOutcome === 'announcement_scheduled') {
    const scheduled = extractScheduledDate(saved);
    const scheduledMs = scheduled ? Date.parse(`${scheduled}T00:00:00Z`) : NaN;
    if (Number.isFinite(scheduledMs) && scheduledMs > checked) {
      due = scheduledMs;
      checkAfter = scheduled;
      nextCheckReason = `organiser_announced_date:${scheduled}`;
    } else {
      nextCheckReason = 'scheduled_recheck';
    }
  } else if (lastOutcome === 'needs_other_source') {
    nextCheckBy = 'codex';
    nextCheckReason = 'try_other_official_source';
  } else if (lastOutcome === 'date_conflict') {
    nextCheckReason = 'date_conflict_recheck';
  } else if (lastOutcome === 'scanned_document') {
    nextCheckReason = 'scanned_document_recheck';
  } else if (lastOutcome === 'planned') {
    nextCheckReason = 'provisional_date_recheck';
  } else if (lastOutcome === 'not_published') {
    nextCheckReason = 'regulations_not_published';
  } else {
    nextCheckReason = 'scheduled_recheck';
  }

  let sourceChanged = false;
  if (changes && (saved.kind === 'find_next_date' || lastOutcome === 'temporary_error' || lastOutcome === 'unchanged_calendar')) {
    for (const href of caseUrls(body)) {
      const source = changes.get(href);
      if (!source) continue;
      const wakeAt = lastOutcome === 'temporary_error'
        ? Math.max(source.at ?? 0, source.recoveredAt ?? 0)
        : (source.at ?? 0);
      if (wakeAt > checked) {
        due = Math.min(due, wakeAt);
        sourceChanged = true;
      }
    }
  }
  if (sourceChanged) {
    nextCheckBy = 'codex';
    nextCheckReason = 'source_changed';
  }

  if (reason === 'scanned_document' && ocr?.answerAt === saved.at && ocr.changed !== false && ocr.documents?.length) {
    due = Math.min(due, Date.parse(ocr.at));
    nextCheckBy = 'codex';
    nextCheckReason = 'new_ocr_available';
  }
  return {
    checkedAt: saved.at,
    nextAt: new Date(due).toISOString(),
    due: due <= now,
    late: due <= now - DAY,
    reason,
    lastOutcome,
    nextCheckReason,
    nextCheckBy,
    ...(checkAfter ? { checkAfter } : {}),
  };
}

function latestAnswer(answers, name) {
  const live = json(path.join(answers, name));
  if (live) return live;
  const earlier = path.join(answers, 'earlier');
  const latest = files(earlier).filter(file => file.endsWith('-' + name)).sort().at(-1);
  return latest ? json(path.join(earlier, latest)) : null;
}

function answerRecords(answers) {
  const earlier = path.join(answers, 'earlier');
  return [
    ...files(earlier).filter(name => /^\d{4}-\d{2}-\d{2}-/.test(name)).map(name => json(path.join(earlier, name))),
    ...files(answers).filter(name => caseFile.test(name)).map(name => json(path.join(answers, name))),
  ].filter(row => row?.case && row?.at);
}

function evaluateAnswers(cases, answers, archive, now = Date.now()) {
  const changes = sourceChanges(archive);
  const ocr = json(path.join(answers, 'ocr.json'), {});
  const verified = new Map(json(path.join(answers, 'verified.json'), []).map(row => [row.case, row]));
  const items = [];
  for (const name of files(answers).filter(name => caseFile.test(name))) {
    const file = path.join(answers, name);
    const saved = json(file);
    if (!saved) continue;
    const body = json(path.join(cases, name));
    const row = verified.get(saved.case);
    const recheck = row?.verified === false && row.answerAt === saved.at && saved.kind !== 'find_races';
    const plan = followup(recheck ? { ...saved, answer: { ...saved.answer, verdict: 'unsure', reason: 'other' } } : saved, body, changes, ocr[saved.case], now);
    items.push({ name, file, saved, body, plan });
  }
  return items;
}

function macRecheckDue(cases, answers, archive, now = Date.now()) {
  return evaluateAnswers(cases, answers, archive, now)
    .filter(item => item.plan?.due && item.plan.nextCheckBy === 'mac')
    .map(item => ({
      case: item.saved.case,
      kind: item.saved.kind,
      checkedAt: item.plan.checkedAt,
      nextAt: item.plan.nextAt,
      lastOutcome: item.plan.lastOutcome,
      nextCheckReason: item.plan.nextCheckReason,
      urls: caseUrls(item.body),
    }));
}

function rotateAnswers(cases, answers, archive, now = Date.now()) {
  const stateFile = path.join(answers, 'followup-state.json');
  const state = json(stateFile, {});
  let stateChanged = false;
  for (const { name, file, saved, body, plan } of evaluateAnswers(cases, answers, archive, now)) {
    if (!plan) continue;
    const entry = {
      case: saved.case,
      kind: saved.kind,
      checkedAt: plan.checkedAt,
      nextAt: plan.nextAt,
      due: plan.due,
      lastOutcome: plan.lastOutcome,
      nextCheckReason: plan.nextCheckReason,
      nextCheckBy: plan.nextCheckBy,
      urls: caseUrls(body),
    };
    if (plan.due && plan.nextCheckBy === 'codex') {
      const earlier = path.join(answers, 'earlier');
      fs.mkdirSync(earlier, { recursive: true });
      fs.renameSync(file, path.join(earlier, saved.at.replace('T', '-').replaceAll(':', '-') + '-' + name));
      entry.rotatedAt = new Date(now).toISOString();
    }
    state[saved.case] = entry;
    stateChanged = true;
  }
  if (stateChanged && fs.existsSync(answers)) {
    fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state, null, 1));
    fs.renameSync(`${stateFile}.tmp`, stateFile);
  }
}

module.exports = {
  DAY,
  caseFile,
  json,
  files,
  reasons,
  uncertainty,
  parseAnnouncementDate,
  classifyOutcome,
  sourceChanges,
  followup,
  latestAnswer,
  answerRecords,
  macRecheckDue,
  rotateAnswers,
};
