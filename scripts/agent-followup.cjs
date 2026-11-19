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

function uncertainty(answer) {
  if (reasons.includes(answer?.reason)) return answer.reason;
  const note = answer?.note ?? '';
  if (/sken|image.only|OCR|obrazov/i.test(note)) return 'scanned_document';
  if (/rozpor|odlišn.*termín|neshod|conflict|disagree/i.test(note)) return 'date_conflict';
  if (/nedostup|nepřístup|inaccessible|captcha/i.test(note)) return 'inaccessible';
  if (/ročník|loňsk|edition|2027/i.test(note)) return 'edition_missing';
  return 'other';
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
    if (page.error || page.asksVerification || page.requestAttempted === false || page.status >= 400 || !page.at || !page.url) continue;
    // Ignore counters, navigation and decoration. Early wake-up needs a new edition signal.
    const signal = fingerprint([page.dateSignals ?? [], page.structuredEvents ?? [], page.follow ?? []]);
    const previous = changed.get(page.url);
    if (!previous) changed.set(page.url, { signal, at: 0 });
    else if (previous.signal !== signal) changed.set(page.url, { signal, at: Date.parse(page.at) });
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
  let days;
  if (saved.kind === 'find_races') days = verdict === 'found' ? 14 : 7;
  else if (verdict === 'not_announced') days = nextEditionInterval(body, checked);
  else if (verdict === 'not_published') {
    const daysUntilRace = (Date.parse(body?.race?.date) - checked) / DAY;
    days = daysUntilRace <= 7 ? 2 : daysUntilRace <= 30 ? 7 : 21;
  } else if (verdict === 'planned') days = 14;
  else if (reason) days = ({ scanned_document: 7, edition_missing: saved.kind === 'find_next_date' ? nextEditionInterval(body, checked) : 7, date_conflict: 3, inaccessible: 14, other: 7 })[reason];
  else if (!verdict) days = 7;
  else return null;

  let due = checked + days * DAY;
  if (saved.kind === 'find_next_date') {
    for (const raw of [body?.race?.website, ...(body?.race?.pages_we_read ?? [])]) {
      if (!raw) continue;
      let url;
      try { url = new URL(raw); url.hash = ''; } catch { continue; }
      const source = changes.get(url.href);
      if (source?.at > checked) due = Math.min(due, source.at);
    }
  }
  if (reason === 'scanned_document' && ocr?.answerAt === saved.at && ocr.changed !== false && ocr.documents?.length) {
    due = Math.min(due, Date.parse(ocr.at));
  }
  return { checkedAt: saved.at, nextAt: new Date(due).toISOString(), due: due <= now, late: due <= now - DAY, reason };
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

function rotateAnswers(cases, answers, archive, now = Date.now()) {
  const changes = sourceChanges(archive);
  const ocr = json(path.join(answers, 'ocr.json'), {});
  const verified = new Map(json(path.join(answers, 'verified.json'), []).map(row => [row.case, row]));
  for (const name of files(answers).filter(name => caseFile.test(name))) {
    const file = path.join(answers, name);
    const saved = json(file);
    if (!saved) continue;
    const row = verified.get(saved.case);
    const recheck = row?.verified === false && row.answerAt === saved.at && saved.kind !== 'find_races';
    const plan = followup(recheck ? {...saved, answer:{...saved.answer, verdict:'unsure', reason:'other'}} : saved, json(path.join(cases, name)), changes, ocr[saved.case], now);
    if (!plan?.due) continue;
    const earlier = path.join(answers, 'earlier');
    fs.mkdirSync(earlier, { recursive: true });
    fs.renameSync(file, path.join(earlier, saved.at.replace('T', '-').replaceAll(':', '-') + '-' + name));
  }
}

module.exports = { DAY, caseFile, json, files, reasons, uncertainty, sourceChanges, followup, latestAnswer, answerRecords, rotateAnswers };
