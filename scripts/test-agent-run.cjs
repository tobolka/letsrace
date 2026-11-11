// The agent runner's limits and the check of answers, with a stand-in for the agent. No AI is called.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const cp = require('node:child_process');
const { checkAnswer, firstObject } = require('./agent-answer.cjs');
const { mayRun, cannotWork } = require('./agent-run.cjs');

const race = { id: '00000000-0000-4000-8000-000000000001', name: 'Cyklokros Slavkov', date: '2026-11-22' };
const pair = { a: race, b: { ...race, id: '00000000-0000-4000-8000-000000000002' } };

// Answers: taken only in the expected shape.
assert.deepEqual(firstObject('Here you go:\n```json\n{"verdict":"unsure","note":"x {y}"}\n```'), { verdict: 'unsure', note: 'x {y}' });
const found = checkAnswer('find_regulations', { race }, JSON.stringify({ verdict: 'found', url: 'https://club.test/propozice.pdf', quote: 'Cyklokros Slavkov u Brna 22. 11. 2026', organiser_site: 'https://club.test', looked_at: ['https://club.test', 'not a link'], note: 'On the club site.' }));
assert.deepEqual(found, { ok: true, answer: { race: race.id, verdict: 'found', url: 'https://club.test/propozice.pdf', quote: 'Cyklokros Slavkov u Brna 22. 11. 2026', organiser_site: 'https://club.test', looked_at: ['https://club.test'], note: 'On the club site.' } });
assert.equal(checkAnswer('find_regulations', { race }, '{"verdict":"found","url":"https://club.test/p.pdf"}').why, 'found, but without a quote');
assert.equal(checkAnswer('find_regulations', { race }, '{"verdict":"found","url":"javascript:alert(1)","quote":"long enough quote"}').ok, false);
assert.equal(checkAnswer('find_regulations', { race }, '{"verdict":"not_published","note":"The club says soon."}').answer.verdict, 'not_published');
assert.equal(checkAnswer('find_regulations', { race }, 'I could not decide.').ok, false);
assert.equal(checkAnswer('decide_duplicate', pair, '{"verdict":"same","evidence":[]}').why, 'a decision without a quoted page');
assert.equal(checkAnswer('decide_duplicate', pair, '{"verdict":"merge them"}').ok, false);
const different = checkAnswer('decide_duplicate', pair, JSON.stringify({ verdict: 'different', evidence: [{ url: 'https://x.test/a', quote: 'Samstag Einzelzeitfahren' }, { url: 'nope', quote: 'Sonntag' }], note: 'TT and road race.' }));
assert.deepEqual(different.answer, { a: pair.a.id, b: pair.b.id, verdict: 'different', evidence: [{ url: 'https://x.test/a', quote: 'Samstag Einzelzeitfahren' }], note: 'TT and road race.' });
assert.equal(checkAnswer('decide_duplicate', pair, '{"verdict":"unsure"}').ok, true);
console.log('PASS: answers are taken only in shape; a decision needs a quoted page');

// Once a day, and stop when the agent cannot work.
assert.equal(mayRun({}, { now: new Date('2026-11-11T10:00:00Z') }).ok, true);
assert.equal(mayRun({ lastRunDay: '2026-11-11' }, { now: new Date('2026-11-11T22:30:00Z') }).ok, false);
assert.equal(mayRun({ lastRunDay: '2026-11-11' }, { now: new Date('2026-11-11T23:30:00Z') }).ok, true); // already the 12th in Prague
assert.equal(mayRun({ lastRunDay: '2026-11-11' }, { now: new Date('2026-11-11T12:00:00Z'), force: true }).ok, true);
assert.ok(cannotWork('Not logged in · Please run /login')); assert.ok(cannotWork('Claude usage limit reached')); assert.ok(!cannotWork('{"verdict":"unsure"}'));
console.log('PASS: one run a day in Prague time; sign-in and allowance problems are recognised');

// The runner itself, with a stand-in agent that answers from the case file.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'letsrace-agent-test-')), cases = path.join(root, 'cases'), out = path.join(root, 'out');
try {
  fs.mkdirSync(cases);
  const list = [1, 2, 3, 4].map(n => ({ case: `regulations-${n}`, kind: 'find_regulations', race: { ...race, id: race.id.slice(0, -1) + n } }));
  for (const item of list) fs.writeFileSync(path.join(cases, `${item.case}.json`), JSON.stringify(item));
  fs.writeFileSync(path.join(cases, 'index.json'), JSON.stringify(list.map(({ case: name, kind }) => ({ case: name, kind }))));
  const stand = `node -e "const c=require(process.cwd()+'/case.json');const n=c.case.at(-1);console.log(n==='2'?'nonsense':JSON.stringify({verdict:'not_published',note:'stand-in '+n}))"`;
  const run = (extra = [], env = {}) => JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, 'agent-run.cjs'), `--cases=${cases}`, `--out=${out}`, ...extra], { encoding: 'utf8', env: { ...process.env, AGENT_CMD: stand, ...env } }).trim().split('\n').at(-1));
  const first = run(['--max=3']);
  assert.deepEqual([first.ran, first.asked, first.answered, first.refused], [true, 3, 2, 1]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'regulations-2.json'), 'utf8')).refused, 'no JSON object in the answer');
  // The same day again: nothing runs, nothing is spent.
  assert.deepEqual(run(['--max=3']), { ran: false, why: `already ran today (${JSON.parse(fs.readFileSync(path.join(out, 'agent-state.json'), 'utf8')).lastRunDay})` });
  // By hand: only the case not asked yet is asked.
  const second = run(['--force']);
  assert.deepEqual([second.asked, second.answered], [1, 1]);
  assert.equal(run(['--force']).asked, 0);
  // An agent that is not signed in stops the run at once, and the case stays open for another day.
  fs.rmSync(path.join(out, 'regulations-4.json')); fs.rmSync(path.join(out, 'regulations-3.json'));
  const stopped = run(['--force'], { AGENT_CMD: 'echo "Not logged in · Please run /login"' });
  assert.equal(stopped.asked, 1); assert.match(stopped.stopped, /cannot work/);
  assert.ok(!fs.existsSync(path.join(out, 'regulations-3.json')));
  // Such a run spent nothing, so it does not use up the day.
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'agent-state.json'), 'utf8')).lastRunDay, undefined);
  assert.equal(run([], { AGENT_CMD: 'echo "Not logged in · Please run /login"' }).ran, true);
  // A case that runs past its time is cut off and recorded, and the run goes on.
  const slow = run(['--force'], { AGENT_CMD: 'sleep 5', AGENT_CASE_SECONDS: '1' });
  assert.deepEqual([slow.asked, slow.timedOut], [2, 2]);
  console.log('PASS: the runner keeps to its case limit, its day, its time, and stops when the agent cannot work');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
