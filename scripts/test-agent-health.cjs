const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  agentHealth,
  applyDiscoverySiteCounts,
  discoveryCountsQuery,
  discoverySiteCountsQuery,
  discoverySources,
} = require('./agent-health.cjs');

const save = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

// Test 1: One finding traced end-to-end from submission all the way to public detail.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-e2e-public-'));
  try {
    const archive = path.join(root, 'organiser-check-2027');
    const cases = path.join(root, 'agent', 'cases');
    const answers = path.join(root, 'agent', 'answers');
    const caseId = 'details-11223344';
    const raceId = '00000000-0000-4000-8000-000000000001';
    const submittedAt = '2026-11-27T08:00:00.000Z';
    const checkNow = Date.parse('2026-11-27T11:30:00.000Z'); // 3.5 hours later

    save(path.join(cases, 'index.json'), [{ case: caseId, kind: 'extract_details' }]);
    save(path.join(cases, caseId + '.json'), { race: { id: raceId, date: '2027-06-14' } });
    save(path.join(answers, caseId + '.json'), {
      case: caseId,
      kind: 'extract_details',
      at: submittedAt,
      answer: { race: raceId, verdict: 'found', facts: { parking: { value: { text: 'U stadionu' } } } },
    });

    // Stage 1: Submitted, waiting for Mac practical review.
    const stage1 = agentHealth(root, archive, checkNow);
    assert.equal(stage1.report.receivedAnswers, 1);
    assert.equal(stage1.report.waiting, 1);
    assert.equal(stage1.report.waitingVerification, 1);
    assert.equal(stage1.report.writtenToCatalogue, 0);
    assert.equal(stage1.report.publiclyVerified, 0);
    assert.equal(stage1.report.waitingItems.length, 1);
    assert.deepEqual(stage1.report.waitingItems[0], {
      case: caseId,
      kind: 'extract_details',
      reason: 'awaiting_practical_review',
      since: submittedAt,
      ageHours: 3.5,
    });

    // Stage 2: Reviewed & saved locally on the Mac (in practicalWrites, not yet confirmed public).
    save(path.join(answers, 'practical-reviewed.json'), {
      [caseId + '.json:' + submittedAt]: {
        at: '2026-11-27T12:00:00.000Z',
        outcome: 'saved',
        detail: { race: raceId, fields: { parking: { text: 'U stadionu' } } },
      },
    });
    const stage2 = agentHealth(root, archive, Date.parse('2026-11-27T12:30:00.000Z'));
    assert.equal(stage2.report.receivedAnswers, 1);
    assert.equal(stage2.report.waitingVerification, 0);
    assert.equal(stage2.report.writtenToCatalogue, 1);
    assert.equal(stage2.report.publiclyVerified, 0);
    assert.equal(stage2.practicalWrites.length, 1);

    // Stage 3: Confirmed on the live public catalogue (mirroring local-cycle.cjs server check).
    const practicalCheck = { published: 1, local: 0 };
    stage2.report.inCatalogue += practicalCheck.published;
    stage2.report.localDetails += practicalCheck.local;
    stage2.report.publiclyVerified += practicalCheck.published;
    stage2.report.writtenToCatalogue = stage2.report.inCatalogue + stage2.report.localDetails;
    assert.equal(stage2.report.inCatalogue, 1);
    assert.equal(stage2.report.writtenToCatalogue, 1);
    assert.equal(stage2.report.publiclyVerified, 1);

    // Also trace a find_regulations answer through verified.json -> applied.json (server write).
    const regCase = 'reg-aabbccdd';
    const regAt = '2026-11-27T09:00:00.000Z';
    save(path.join(cases, 'index.json'), [
      { case: caseId, kind: 'extract_details' },
      { case: regCase, kind: 'find_regulations' },
    ]);
    save(path.join(cases, regCase + '.json'), { race: { id: raceId, date: '2027-06-14' } });
    save(path.join(answers, regCase + '.json'), {
      case: regCase,
      kind: 'find_regulations',
      at: regAt,
      answer: { race: raceId, verdict: 'found', url: 'https://race.example/propozice.pdf', quote: 'Start 14. 6. 2027' },
    });
    save(path.join(answers, 'verified.json'), [{ case: regCase, answerAt: regAt, verified: true }]);
    const regWaitingApply = agentHealth(root, archive, Date.parse('2026-11-27T13:00:00.000Z')).report;
    assert.equal(regWaitingApply.receivedAnswers, 2);
    assert.equal(regWaitingApply.waitingVerification, 1);
    assert.equal(regWaitingApply.waitingItems[0].case, regCase);
    assert.equal(regWaitingApply.waitingItems[0].reason, 'awaiting_apply');
    assert.equal(regWaitingApply.waitingItems[0].ageHours, 4);

    save(path.join(answers, 'applied.json'), {
      [regCase]: { at: '2026-11-27T13:15:00.000Z', outcome: 'applied', reason: null },
    });
    const regApplied = agentHealth(root, archive, Date.parse('2026-11-27T13:30:00.000Z')).report;
    assert.equal(regApplied.receivedAnswers, 2);
    assert.equal(regApplied.waitingVerification, 0);
    assert.equal(regApplied.inCatalogue, 1);
    assert.equal(regApplied.writtenToCatalogue, 2); // 1 practicalWrite + 1 applied reg
    assert.equal(regApplied.publiclyVerified, 1); // applied reg confirmed on server
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Test 2: One case that stops during verification, showing reason and age.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-e2e-blocked-'));
  try {
    const archive = path.join(root, 'organiser-check-2027');
    const cases = path.join(root, 'agent', 'cases');
    const answers = path.join(root, 'agent', 'answers');
    const badReg = 'reg-deadbeef';
    const badDetail = 'details-cafebabe';
    const regAt = '2026-11-25T10:00:00.000Z';
    const detailAt = '2026-11-26T10:00:00.000Z';
    const detailReviewedAt = '2026-11-26T12:00:00.000Z';
    const now = Date.parse('2026-11-27T10:00:00.000Z');

    save(path.join(cases, 'index.json'), [
      { case: badReg, kind: 'find_regulations' },
      { case: badDetail, kind: 'extract_details' },
    ]);
    save(path.join(cases, badReg + '.json'), { race: { id: 'r1', date: '2027-07-01' } });
    save(path.join(cases, badDetail + '.json'), { race: { id: 'r2', date: '2027-07-02' } });
    save(path.join(answers, badReg + '.json'), {
      case: badReg,
      kind: 'find_regulations',
      at: regAt,
      answer: { race: 'r1', verdict: 'found', url: 'https://club.example/reg', quote: 'missing quote' },
    });
    save(path.join(answers, badDetail + '.json'), {
      case: badDetail,
      kind: 'extract_details',
      at: detailAt,
      answer: { race: 'r2', verdict: 'found', facts: {} },
    });
    save(path.join(answers, 'verified.json'), [
      {
        case: badReg,
        answerAt: regAt,
        verified: false,
        why: 'quote not found',
        checks: [{ url: 'https://club.example/reg', read: true, quoteFound: false }],
      },
    ]);
    save(path.join(answers, 'practical-reviewed.json'), {
      [badDetail + '.json:' + detailAt]: {
        at: detailReviewedAt,
        outcome: 'evidence_rejected',
        detail: { reason: 'quote_mismatch' },
      },
    });

    const report = agentHealth(root, archive, now).report;
    assert.equal(report.receivedAnswers, 2);
    assert.equal(report.waitingVerification, 0);
    assert.equal(report.writtenToCatalogue, 0);
    assert.equal(report.publiclyVerified, 0);
    assert.equal(report.blocked, 2);
    assert.equal(report.blockedItems.length, 2);
    // Oldest first: badReg (48h) before badDetail (22h since review).
    assert.deepEqual(report.blockedItems[0], {
      case: badReg,
      kind: 'find_regulations',
      reason: 'quote not found',
      since: regAt,
      ageHours: 48,
    });
    assert.deepEqual(report.blockedItems[1], {
      case: badDetail,
      kind: 'extract_details',
      reason: 'quote_mismatch',
      since: detailReviewedAt,
      ageHours: 22,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Test 3: New websites (discoverySources) with firstReadAt, read count, and publishedRaces.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-finder-e2e-discovery-'));
  try {
    save(path.join(root, 'agent', 'discovery', 'CZ-2027', '2026-11-27.json'), [
      'https://novy-pohar.cz/',
      'https://cekajici-web.cz/',
    ]);
    save(path.join(root, 'discovery', 'CZ-2027', 'queue.json'), {
      tasks: {
        t1: {
          id: 't1',
          kind: 'read',
          url: 'https://novy-pohar.cz/',
          origins: ['agent-discovery:2026-11-27.json'],
          history: [
            { at: '2026-11-27T07:00:00.000Z', error: 'timeout', result: null },
            { at: '2026-11-27T09:15:00.000Z', result: { complete: true } },
            { at: '2026-11-27T14:00:00.000Z', result: { complete: true } },
          ],
        },
        t2: {
          id: 't2',
          kind: 'read',
          url: 'https://cekajici-web.cz/',
          origins: ['agent-discovery:2026-11-27.json'],
          history: [],
        },
      },
    });

    const sources = discoverySources(root);
    assert.equal(sources.submitted, 2);
    assert.equal(sources.read, 1);
    assert.equal(sources.firstReadAt, '2026-11-27T09:15:00.000Z');
    assert.equal(sources.publishedRaces, 0);
    assert.equal(sources.sites.length, 2);
    assert.deepEqual(sources.sites[0], {
      url: 'https://novy-pohar.cz/',
      scope: 'CZ-2027',
      submittedAt: '2026-11-27',
      firstReadAt: '2026-11-27T09:15:00.000Z',
      read: true,
      publishedRaces: 0,
    });
    assert.deepEqual(sources.sites[1], {
      url: 'https://cekajici-web.cz/',
      scope: 'CZ-2027',
      submittedAt: '2026-11-27',
      firstReadAt: null,
      read: false,
      publishedRaces: 0,
    });

    applyDiscoverySiteCounts(sources, { 'https://novy-pohar.cz/kalendar': 3 });
    assert.equal(sources.sites[0].publishedRaces, 3);
    assert.equal(sources.sites[1].publishedRaces, 0);

    const sampleKey = 'a'.repeat(64);
    assert.match(discoveryCountsQuery([sampleKey]), /pipeline_candidates/);
    assert.match(discoverySiteCountsQuery([sampleKey]), /json_object_agg\(source_url, published\)/);
    assert.throws(() => discoverySiteCountsQuery(['bad']), /Invalid/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log('PASS: agent health funnel, waiting/blocked reasons with age, and discovery source tracking');
