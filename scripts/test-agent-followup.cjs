const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkAnswer } = require('./agent-answer.cjs');
const { DAY, answerRecords, classifyOutcome, followup, macRecheckDue, parseAnnouncementDate, rotateAnswers, sourceChanges } = require('./agent-followup.cjs');
const { agentHealth, discoveryCountsQuery, practicalCountsQuery } = require('./agent-health.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-followup-'));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const at = new Date('2026-11-18T08:00:00Z');
const name = 'nextdate-01234567';
const caseName = name + '.json';
const url = 'https://club.example/';
const body = { wanted_year: 2027, race: { last_date: '2026-10-17', id: '01234567', website: url } };
const record = { case: name, kind: 'find_next_date', at: at.toISOString(), answer: { verdict: 'not_announced', race: '01234567' } };
try {
  const archive = path.join(root, 'organiser-check-2027');
  const cases = path.join(root, 'agent', 'cases');
  const answers = path.join(root, 'agent', 'answers');
  for (const dir of [archive, cases, answers]) fs.mkdirSync(dir, { recursive: true });
  save(path.join(cases, caseName), body);
  const answerFile = path.join(answers, caseName);
  save(answerFile, record);
  save(path.join(cases, 'index.json'), [{ case: name, kind: record.kind }]);
  const ledger = path.join(archive, 'pages.jsonl');
  const page = (days, dates, more = {}) => JSON.stringify({ url, at: new Date(+at + days * DAY), status: 200, dateSignals: dates, ...more });
  fs.writeFileSync(ledger, [page(-1, []), page(1, []), page(2, ['17.10.2027'], {asksVerification:true})].join('\n'));
  const regular = followup(record, body, sourceChanges(archive), null, +at + 3 * DAY);
  assert.equal(regular.due, false);
  assert.equal(Date.parse(regular.nextAt), +at + 28 * DAY);
  for (const [last_date, days] of [['2026-01-15', 7], ['2026-03-01', 14], ['2026-10-17', 28], [undefined, 14]]) {
    const candidate = { ...body, race: { ...body.race, last_date } };
    const plan = followup(record, candidate, new Map(), null, +at);
    assert.equal(Date.parse(plan.nextAt), +at + days * DAY);
  }
  assert.equal(agentHealth(root, archive, +at + 3 * DAY).report.planned, 1);
  fs.appendFileSync(ledger, '\n' + page(3, ['17.10.2027']));
  rotateAnswers(cases, answers, archive, +at + 4 * DAY);
  assert.equal(fs.existsSync(answerFile), false);
  assert.equal(answerRecords(answers).length, 1);
  const report = agentHealth(root, archive, +at + 4 * DAY).report;
  assert.equal(report.due, 1);
  assert.equal(report.late, 1);
  assert.equal(report.planned, 0);
  save(path.join(archive,'edition-status.json'), {rows:[{race:'01234567',state:'published',date:'2027-10-17'}]});
  save(answerFile,{...record,answer:{...record.answer,verdict:'announced',start_date:'2027-10-17'}});
  save(path.join(answers,'verified.json'),[{case:name,answerAt:record.at,verified:true}]);
  assert.equal(agentHealth(root,archive,+at+5*DAY).report.inCatalogue,1);

  const scan = { ...record, kind: 'extract_details', answer: { verdict: 'unsure', reason: 'scanned_document' } };
  const ocr = { answerAt: scan.at, at: new Date(+at + DAY).toISOString(), documents: [{ url, text: 'Proof' }] };
  assert.equal(followup(scan, body, new Map(), ocr, +at + DAY).due, true);
  assert.equal(followup(scan, body, new Map(), { ...ocr, changed:false }, +at + DAY).due, false);
  assert.equal(checkAnswer('find_next_date', body, '{"verdict":"unsure","reason":"date_conflict"}').answer.reason, 'date_conflict');
  assert.throws(() => discoveryCountsQuery(["'"]), /Invalid/);
  assert.match(practicalCountsQuery([]), /jsonb_to_recordset/);

  // --- Improvement Point 3: outcome-aware follow-up ---
  const refMs = Date.parse('2026-11-18T08:00:00Z');
  assert.equal(parseAnnouncementDate('Pořadatel kalendář dokončí 30. listopadu.', refMs), '2026-11-30');
  assert.equal(parseAnnouncementDate('30. 11.', refMs), '2026-11-30');
  assert.equal(parseAnnouncementDate('30.11.2026', refMs), '2026-11-30');
  assert.equal(parseAnnouncementDate('Calendar finalized November 30', refMs), '2026-11-30');
  assert.equal(parseAnnouncementDate('Předběžně 15. 5. 2027, kalendář dokončí 30. listopadu.', refMs), '2026-11-30');
  assert.equal(parseAnnouncementDate('Termínovka vyjde 15. ledna.', refMs), '2027-01-15');

  // 1. Sumator 502: temporary HTTP error -> Mac recheck first, rotates to Codex only on recovery/change
  const sumatorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-sumator-'));
  try {
    const sArchive = path.join(sumatorRoot, 'organiser-check-2027');
    const sCases = path.join(sumatorRoot, 'agent', 'cases');
    const sAnswers = path.join(sumatorRoot, 'agent', 'answers');
    for (const dir of [sArchive, sCases, sAnswers]) fs.mkdirSync(dir, { recursive: true });
    const sumatorUrl = 'https://sumator.cz/zavod';
    const sumatorCase = 'nextdate-50200001';
    const sumatorBody = { case: sumatorCase, kind: 'find_next_date', wanted_year: 2027, race: { id: '50200001', last_date: '2026-09-12', website: sumatorUrl } };
    const sumatorChecked = checkAnswer('find_next_date', sumatorBody, JSON.stringify({
      verdict: 'unsure',
      reason: 'inaccessible',
      http_status: 502,
      note: 'Sumator opakovaně vrací HTTP 502 Bad Gateway.',
    }));
    assert.equal(sumatorChecked.ok, true);
    assert.equal(sumatorChecked.answer.http_status, 502);
    const sumatorSaved = { case: sumatorCase, kind: 'find_next_date', at: at.toISOString(), answer: sumatorChecked.answer };
    save(path.join(sCases, sumatorCase + '.json'), sumatorBody);
    save(path.join(sCases, 'index.json'), [{ case: sumatorCase, kind: 'find_next_date' }]);
    const sumatorAnswerFile = path.join(sAnswers, sumatorCase + '.json');
    save(sumatorAnswerFile, sumatorSaved);
    const sLedger = path.join(sArchive, 'pages.jsonl');
    fs.writeFileSync(sLedger, [
      JSON.stringify({ url: sumatorUrl, at: new Date(+at - DAY), status: 502 }),
      JSON.stringify({ url: sumatorUrl, at: new Date(+at + DAY), status: 502 }),
    ].join('\n'));

    const sPlanBefore = followup(sumatorSaved, sumatorBody, sourceChanges(sArchive), null, +at + 2 * DAY);
    assert.equal(sPlanBefore.lastOutcome, 'temporary_error');
    assert.equal(sPlanBefore.nextCheckBy, 'mac');
    assert.equal(sPlanBefore.nextCheckReason, 'temporary_http_error');
    assert.equal(sPlanBefore.due, true);

    rotateAnswers(sCases, sAnswers, sArchive, +at + 2 * DAY);
    assert.equal(fs.existsSync(sumatorAnswerFile), true, '502 temporary error should not rotate back to Codex before recovery');
    const dueMac = macRecheckDue(sCases, sAnswers, sArchive, +at + 2 * DAY);
    assert.equal(dueMac.length, 1);
    assert.equal(dueMac[0].case, sumatorCase);
    assert.equal(dueMac[0].lastOutcome, 'temporary_error');
    assert.deepEqual(dueMac[0].urls, [sumatorUrl]);

    // Source recovers with HTTP 200 after checked -> switches to Codex and rotates
    fs.appendFileSync(sLedger, '\n' + JSON.stringify({ url: sumatorUrl, at: new Date(+at + 3 * DAY), status: 200, dateSignals: ['12.09.2027'] }));
    const sPlanRecovered = followup(sumatorSaved, sumatorBody, sourceChanges(sArchive), null, +at + 3 * DAY);
    assert.equal(sPlanRecovered.nextCheckBy, 'codex');
    assert.equal(sPlanRecovered.nextCheckReason, 'source_changed');
    assert.equal(sPlanRecovered.due, true);
    rotateAnswers(sCases, sAnswers, sArchive, +at + 3 * DAY);
    assert.equal(fs.existsSync(sumatorAnswerFile), false, 'recovered source should rotate to earlier/ for Codex');

    // Verify agent-desk next includes previousReview
    const deskOut = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'agent-desk.cjs'), 'next', '--max=5'], {
      env: { ...process.env, LETSRACE_DATA_DIR: sumatorRoot },
      encoding: 'utf8',
    }));
    assert.equal(deskOut.cases.length, 1);
    assert.equal(deskOut.cases[0].previousReview.verdict, 'unsure');
    assert.equal(deskOut.cases[0].previousReview.lastOutcome, 'temporary_error');
    assert.equal(deskOut.cases[0].previousReview.nextCheckReason, 'source_changed');
  } finally {
    fs.rmSync(sumatorRoot, { recursive: true, force: true });
  }

  // 2. Slovak federation calendar (cyklistikaszc.sk) showing only 2026 -> unchanged_calendar, Mac-first
  const szcRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-szc-'));
  try {
    const zArchive = path.join(szcRoot, 'organiser-check-2027');
    const zCases = path.join(szcRoot, 'agent', 'cases');
    const zAnswers = path.join(szcRoot, 'agent', 'answers');
    for (const dir of [zArchive, zCases, zAnswers]) fs.mkdirSync(dir, { recursive: true });
    const szcUrl = 'https://www.cyklistikaszc.sk/sk/kalendar';
    const szcCase = 'nextdate-52c00002';
    const szcBody = { case: szcCase, kind: 'find_next_date', wanted_year: 2027, race: { id: '52c00002', last_date: '2026-10-10', website: szcUrl } };
    const szcSaved = {
      case: szcCase,
      kind: 'find_next_date',
      at: at.toISOString(),
      answer: { race: '52c00002', verdict: 'not_announced', note: 'Kalendář cyklistikaszc.sk je dostupný, ale stále ukazuje jen rok 2026.' },
    };
    save(path.join(zCases, szcCase + '.json'), szcBody);
    save(path.join(zCases, 'index.json'), [{ case: szcCase, kind: 'find_next_date' }]);
    const szcAnswerFile = path.join(zAnswers, szcCase + '.json');
    save(szcAnswerFile, szcSaved);
    const zLedger = path.join(zArchive, 'pages.jsonl');
    fs.writeFileSync(zLedger, [
      JSON.stringify({ url: szcUrl, at: new Date(+at - DAY), status: 200, dateSignals: ['10.10.2026'] }),
      JSON.stringify({ url: szcUrl, at: new Date(+at + 10 * DAY), status: 200, dateSignals: ['10.10.2026'] }),
    ].join('\n'));

    const zPlanUnchanged = followup(szcSaved, szcBody, sourceChanges(zArchive), null, +at + 30 * DAY);
    assert.equal(zPlanUnchanged.lastOutcome, 'unchanged_calendar');
    assert.equal(zPlanUnchanged.nextCheckBy, 'mac');
    assert.equal(zPlanUnchanged.nextCheckReason, 'calendar_still_previous_year');
    assert.equal(zPlanUnchanged.due, true);

    rotateAnswers(zCases, zAnswers, zArchive, +at + 30 * DAY);
    assert.equal(fs.existsSync(szcAnswerFile), true, 'unchanged calendar stays off Codex queue');
    const zMacDue = macRecheckDue(zCases, zAnswers, zArchive, +at + 30 * DAY);
    assert.equal(zMacDue.length, 1);
    assert.equal(zMacDue[0].lastOutcome, 'unchanged_calendar');

    // Calendar updates with 2027 dates -> switches to Codex and rotates
    fs.appendFileSync(zLedger, '\n' + JSON.stringify({ url: szcUrl, at: new Date(+at + 31 * DAY), status: 200, dateSignals: ['09.10.2027'] }));
    const zPlanChanged = followup(szcSaved, szcBody, sourceChanges(zArchive), null, +at + 31 * DAY);
    assert.equal(zPlanChanged.nextCheckBy, 'codex');
    assert.equal(zPlanChanged.nextCheckReason, 'source_changed');
    rotateAnswers(zCases, zAnswers, zArchive, +at + 31 * DAY);
    assert.equal(fs.existsSync(szcAnswerFile), false, 'changed 2027 calendar rotates to earlier/ for Codex');
  } finally {
    fs.rmSync(szcRoot, { recursive: true, force: true });
  }

  // 3. Pegnitz provisional date with organiser stating "kalendář dokončí 30. listopadu"
  const pegnitzBody = { wanted_year: 2027, race: { id: 'pegnitz1', last_date: '2026-05-16', website: 'https://pegnitz.example/' } };
  const pegnitzChecked = checkAnswer('find_next_date', pegnitzBody, JSON.stringify({
    verdict: 'planned',
    start_date: '2027-05-15',
    end_date: null,
    url: 'https://pegnitz.example/2027',
    quote: 'Voraussichtlich am 15.05.2027, Kalender wird am 30. November finalisiert.',
    note: 'Předběžný termín, pořadatel uvedl, že kalendář dokončí 30. listopadu.',
  }));
  assert.equal(pegnitzChecked.ok, true);
  const pegnitzSaved = { case: 'nextdate-deadbeef', kind: 'find_next_date', at: at.toISOString(), answer: pegnitzChecked.answer };
  const pegnitzPlan = followup(pegnitzSaved, pegnitzBody, new Map(), null, Date.parse('2026-11-29T12:00:00Z'));
  assert.equal(pegnitzPlan.lastOutcome, 'announcement_scheduled');
  assert.equal(pegnitzPlan.nextAt, '2026-11-30T00:00:00.000Z');
  assert.equal(pegnitzPlan.nextCheckReason, 'organiser_announced_date:2026-11-30');
  assert.equal(pegnitzPlan.nextCheckBy, 'codex');
  assert.equal(pegnitzPlan.due, false);
  const pegnitzDue = followup(pegnitzSaved, pegnitzBody, new Map(), null, Date.parse('2026-11-30T06:00:00Z'));
  assert.equal(pegnitzDue.due, true);

  // Explicit check_after on not_announced / not_published
  const explicitCheckAfter = checkAnswer('find_next_date', pegnitzBody, JSON.stringify({
    verdict: 'not_announced',
    check_after: '2026-11-30',
    note: 'Pořadatel oznámil zveřejnění na konci listopadu.',
  }));
  assert.equal(explicitCheckAfter.ok, true);
  assert.equal(explicitCheckAfter.answer.check_after, '2026-11-30');
  const explicitPlan = followup({ case: 'nextdate-deadbee2', kind: 'find_next_date', at: at.toISOString(), answer: explicitCheckAfter.answer }, pegnitzBody, new Map(), null, +at);
  assert.equal(explicitPlan.nextAt, '2026-11-30T00:00:00.000Z');
  assert.equal(explicitPlan.nextCheckReason, 'organiser_announced_date:2026-11-30');

  // 4. Explicit needs_other_source -> routes to Codex when due
  const otherSourceSaved = {
    case: 'nextdate-074e5001',
    kind: 'find_next_date',
    at: at.toISOString(),
    answer: {
      race: '074e5001',
      verdict: 'unsure',
      reason: 'other',
      outcome: 'needs_other_source',
      note: 'Stávající web neodpovídá, je potřeba zkusit jiný oficiální zdroj.',
    },
  };
  assert.equal(classifyOutcome(otherSourceSaved, body), 'needs_other_source');
  const otherPlan = followup(otherSourceSaved, body, new Map(), null, +at + 7 * DAY);
  assert.equal(otherPlan.lastOutcome, 'needs_other_source');
  assert.equal(otherPlan.nextCheckBy, 'codex');
  assert.equal(otherPlan.nextCheckReason, 'try_other_official_source');
  assert.equal(otherPlan.due, true);

  console.log('PASS: delayed retries, early source changes, OCR handoff, catalogue receipt, archived quota, and outcome-aware follow-up');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
