const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkAnswer } = require('./agent-answer.cjs');
const { DAY, answerRecords, sourceChanges, followup, rotateAnswers } = require('./agent-followup.cjs');
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
  console.log('PASS: delayed retries, early source changes, OCR handoff, catalogue receipt and archived quota');
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
