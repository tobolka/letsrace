const path = require('node:path');
const { createHash } = require('node:crypto');
const { PROMPTS } = require('./agent-answer.cjs');
const { answerRecords, files, followup, json, sourceChanges, uncertainty, DAY } = require('./agent-followup.cjs');

function discoveryKeys(data) {
  const directory = path.join(data, 'discovery');
  const keys = new Set();
  for (const name of files(directory).filter(name => /^[A-Z]{2}-\d{4}$/.test(name))) {
    const folder = path.join(directory, name);
    const handoff = json(path.join(folder, 'candidate-handoff.json'));
    for (const key of handoff?.agentCandidateKeys ?? []) keys.add(key);
    if (!handoff || handoff.agentCandidateKeys) continue;
    // Older handoffs predate agent attribution. Reconstruct the same key from
    // the canonical source stored in the queue and let the database confirm it.
    const queue = json(path.join(folder, 'queue.json'), { tasks: {}, candidates: {} });
    const tasks = queue.tasks;
    const agentTasks = new Set(Object.values(tasks).filter(task =>
      task.origins.some(origin => origin.startsWith('agent-discovery:'))).map(task => task.id));
    for (let depth = 0; depth < 2; depth++) for (const task of Object.values(tasks)) {
      if (task.origins.some(id => agentTasks.has(id))) agentTasks.add(task.id);
    }
    for (const candidate of Object.values(queue.candidates)) {
      if (candidate.state === 'out_of_scope' || !candidate.origins.some(id => agentTasks.has(id))) continue;
      const identity = [candidate.sourceUrl, candidate.event.externalId, candidate.event.startDate.slice(0, 4)].join(':');
      keys.add(createHash('sha256').update(identity).digest('hex'));
    }
  }
  return [...keys].filter(key => /^[a-f0-9]{64}$/.test(key));
}

function normalizeUrl(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';
}

function ageHours(since, now) {
  const ts = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.round(((now - ts) / 3_600_000) * 10) / 10);
}

function sortOldestFirst(items) {
  return items.sort((a, b) => {
    const ta = a.since ? Date.parse(a.since) : Number.POSITIVE_INFINITY;
    const tb = b.since ? Date.parse(b.since) : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return String(a.case).localeCompare(String(b.case));
  });
}

function verificationFailureReason(saved, check) {
  if (!saved.answer) return saved.refused ? `refused: ${saved.refused}` : 'missing_answer';
  if (check?.why) return check.why;
  if (Array.isArray(check?.checks) && check.checks.length) {
    if (check.checks.some(entry => entry.read === false)) return 'page_unreadable';
    if (check.checks.some(entry => entry.quoteFound === false)) return 'quote_not_found';
    if (check.checks.some(entry => entry.statesDate === false)) return 'date_not_in_quote';
  }
  return 'verification_failed';
}

function discoverySources(data) {
  const inbox = path.join(data, 'agent', 'discovery');
  let submitted = 0, read = 0;
  let firstReadAt = null;
  const sites = [];
  for (const scope of files(inbox).filter(name => /^[A-Z]{2}-\d{4}$/.test(name)).sort()) {
    const folder = path.join(inbox, scope);
    const submittedByUrl = new Map();
    for (const name of files(folder).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort()) {
      const submittedAt = name.slice(0, 10);
      for (const url of json(path.join(folder, name), [])) {
        if (typeof url === 'string' && !submittedByUrl.has(url)) submittedByUrl.set(url, submittedAt);
      }
    }
    submitted += submittedByUrl.size;
    const queue = json(path.join(data, 'discovery', scope, 'queue.json'), { tasks: {} });
    const readUrls = new Set();
    const firstReadByUrl = new Map();
    const firstReadByNorm = new Map();
    for (const task of Object.values(queue.tasks ?? {})) {
      if (task.kind !== 'read' || !task.origins?.some(origin => origin.startsWith('agent-discovery:'))) continue;
      const ok = (task.history ?? []).filter(entry => !entry.error && entry.result?.complete !== false);
      if (!ok.length) continue;
      readUrls.add(task.url);
      const timestamps = ok.map(entry => entry.at).filter(Boolean).sort();
      const earliest = timestamps[0] ?? null;
      if (earliest) {
        if (!firstReadAt || earliest < firstReadAt) firstReadAt = earliest;
        const prev = firstReadByUrl.get(task.url);
        if (!prev || earliest < prev) firstReadByUrl.set(task.url, earliest);
        const norm = normalizeUrl(task.url);
        const prevNorm = firstReadByNorm.get(norm);
        if (!prevNorm || earliest < prevNorm) firstReadByNorm.set(norm, earliest);
      }
    }
    read += readUrls.size;
    for (const [url, submittedAt] of submittedByUrl) {
      const norm = normalizeUrl(url);
      const siteFirstRead = firstReadByUrl.get(url) ?? firstReadByNorm.get(norm) ?? null;
      const wasRead = readUrls.has(url) || Boolean(siteFirstRead);
      sites.push({ url, scope, submittedAt, firstReadAt: siteFirstRead, read: wasRead, publishedRaces: 0 });
    }
  }
  return { submitted, read, firstReadAt, publishedRaces: 0, sites };
}

function discoverySiteCountsQuery(keys) {
  if (keys.some(key => !/^[a-f0-9]{64}$/.test(key))) throw Error('Invalid discovery candidate key');
  const values = keys.length ? keys.map(key => "'" + key + "'").join(',') : 'null';
  return 'with reviewed as (select distinct on (c.candidate_key) c.source_url, c.status, c.decision, ' +
    'e.id as public_id from pipeline_candidates c left join events e on e.id=c.event_id ' +
    "and e.visibility='public' and e.merged_into_id is null and e.status is distinct from 'hidden' " +
    'where c.candidate_key in (' + values + ') order by c.candidate_key, c.updated_at desc, c.id desc), ' +
    'by_site as (select source_url, count(distinct public_id) filter(where status=\'published\' and ' +
    "decision->'expectedEventId'='null'::jsonb) as published from reviewed where source_url is not null group by source_url) " +
    "select coalesce(json_object_agg(source_url, published), '{}'::json) from by_site where published > 0";
}

function applyDiscoverySiteCounts(sources, siteCounts) {
  if (!sources?.sites?.length || !siteCounts || typeof siteCounts !== 'object') return;
  for (const site of sources.sites) {
    const normSite = normalizeUrl(site.url);
    let count = 0;
    for (const [sourceUrl, published] of Object.entries(siteCounts)) {
      const normSource = normalizeUrl(sourceUrl);
      if (sourceUrl === site.url || normSource === normSite || (normSite && normSource.startsWith(normSite + '/'))) {
        count += Number(published) || 0;
      }
    }
    site.publishedRaces = count;
  }
}

function discoveryCountsQuery(keys) {
  if (keys.some(key => !/^[a-f0-9]{64}$/.test(key))) throw Error('Invalid discovery candidate key');
  const values = keys.length ? keys.map(key => "'" + key + "'").join(',') : 'null';
  return 'with reviewed as (select distinct on (c.candidate_key) c.status, c.event_id, c.decision, ' +
    'e.id as public_id from pipeline_candidates c left join events e on e.id=c.event_id ' +
    "and e.visibility='public' and e.merged_into_id is null and e.status is distinct from 'hidden' " +
    'where c.candidate_key in (' + values + ') order by c.candidate_key, c.updated_at desc, c.id desc) ' +
    "select json_build_object('waiting',count(*) filter(where status in ('pending','waiting','publishing')), " +
    "'blocked',count(*) filter(where status='conflict'), 'published',count(distinct public_id) " +
    "filter(where status='published' and decision->'expectedEventId'='null'::jsonb)) from reviewed";
}

function agentHealth(data, archive, now = Date.now()) {
  const agent = path.join(data, 'agent');
  const cases = path.join(agent, 'cases'), answers = path.join(agent, 'answers');
  const index = json(path.join(cases, 'index.json'));
  if (!index) return null;
  const changes = sourceChanges(archive);
  const ocr = json(path.join(answers, 'ocr.json'), {});
  const practical = json(path.join(answers, 'practical-reviewed.json'), {});
  const applied = json(path.join(answers, 'applied.json'), {});
  const verified = new Map(json(path.join(answers, 'verified.json'), []).map(row => [row.case, row]));
  const editions = new Map(archive ? json(path.join(archive, 'edition-status.json'), { rows: [] }).rows.map(row => [row.race,row]) : []);
  const current = new Set(index.map(row => row.case));
  const latest = new Map();
  for (const row of answerRecords(answers)) {
    if (!(latest.get(row.case)?.at > row.at)) latest.set(row.case, row);
  }
  const practicalWrites = [];
  const waitingItems = [];
  const blockedItems = [];
  const pushWaiting = (id, kind, reason, since) => waitingItems.push({ case: id, kind: kind ?? null, reason, since: since ?? null, ageHours: ageHours(since, now) });
  const pushBlocked = (id, kind, reason, since) => blockedItems.push({ case: id, kind: kind ?? null, reason, since: since ?? null, ageHours: ageHours(since, now) });
  const report = { at: new Date(now).toISOString(), due: 0, ready: 0, planned: 0, late: 0,
    waiting: 0, inCatalogue: 0, blocked: 0, localDetails: 0, confirmedDetails: 0,
    receivedAnswers: latest.size, waitingVerification: 0, writtenToCatalogue: 0, publiclyVerified: 0,
    waitingItems: [], blockedItems: [],
    reasons: { date_conflict: 0, scanned_document: 0, edition_missing: 0, inaccessible: 0, other: 0 } };
  for (const item of index) {
    const row = latest.get(item.case);
    const activeAnswer = json(path.join(answers, item.case + '.json'));
    if (!activeAnswer && PROMPTS[item.kind]) report.ready++;
    if (!row || !activeAnswer) {
      report.due++;
      const body = json(path.join(cases, item.case + '.json'));
      if (!row && Date.parse(body?.queuedAt) <= now - DAY) report.late++;
    }
  }
  for (const [id, saved] of latest) {
    const answer = saved.answer ?? {};
    const body = json(path.join(cases, id + '.json'));
    const edition = editions.get(answer.race);
    if (answer.verdict === 'unsure') report.reasons[uncertainty(answer)]++;
    const check = verified.get(id);
    const rejected = check?.verified === false && (!check.answerAt || check.answerAt === saved.at);
    const plan = followup(rejected && answer.verdict ? {...saved, answer: {...answer, verdict: 'unsure', reason: 'other'}} : saved,
      body, changes, ocr[id], now);
    const expires = body?.race?.end_date ?? body?.race?.date;
    const expired = expires && Date.parse(expires) < now - DAY;
    const open = current.has(id) && !json(path.join(answers, id + '.json'));
    const closedEdition = ['found','published'].includes(edition?.state) && saved.kind === 'find_next_date';
    if (plan && !closedEdition && !expired) {
      if (!plan.due) report.planned++;
      else if (open && plan.late) report.late++;
      else if (!open && (edition?.state === 'waiting' || edition?.state === 'year_only' || edition?.state === 'not_announced')) {
        report.due++;
        if (plan.late) report.late++;
      }
    }
    if (['not_announced','not_published','none','unsure','planned'].includes(answer.verdict)) continue;

    if (['extract_details','verify_details'].includes(saved.kind)) {
      const reviewed = practical[id + '.json:' + saved.at];
      if (!reviewed) {
        report.waiting++;
        pushWaiting(id, saved.kind, 'awaiting_practical_review', saved.at);
      } else if (['saved','applied'].includes(reviewed.outcome)) {
        if (reviewed.detail?.skipped?.length) {
          report.blocked++;
          const skipReason = reviewed.detail.skipped[0]?.reason ?? 'fields_skipped';
          pushBlocked(id, saved.kind, skipReason, reviewed.at ?? saved.at);
        }
        if (reviewed.detail?.race && Object.keys(reviewed.detail.fields ?? {}).length) {
          practicalWrites.push({ race: reviewed.detail.race, fields: reviewed.detail.fields });
        } else if (Array.isArray(reviewed.detail?.fields) && reviewed.detail.fields.length) report.localDetails++;
      } else if (reviewed.outcome === 'confirmed') report.confirmedDetails++;
      else if (['needs_review','evidence_rejected'].includes(reviewed.outcome)) {
        report.blocked++;
        pushBlocked(id, saved.kind, reviewed.detail?.reason ?? reviewed.outcome, reviewed.at ?? saved.at);
      }
    } else if (rejected || !saved.answer) {
      report.blocked++;
      pushBlocked(id, saved.kind, verificationFailureReason(saved, check), check?.at ?? saved.at);
    } else if (!check || check.answerAt && check.answerAt !== saved.at) {
      report.waiting++;
      pushWaiting(id, saved.kind, 'awaiting_verification', saved.at);
    } else if (answer.verdict === 'announced') {
      if (closedEdition && edition.date === answer.start_date) {
        report.inCatalogue++;
        if (edition.state === 'published') report.publiclyVerified++;
      } else if (edition?.state === 'conflict' || edition?.reason === 'publish_failed') {
        report.blocked++;
        pushBlocked(id, saved.kind, edition?.reason ?? edition?.state, edition?.at ?? saved.at);
      } else {
        report.waiting++;
        pushWaiting(id, saved.kind, edition?.reason ?? (edition?.state ? `edition_${edition.state}` : 'awaiting_edition_publish'), saved.at);
      }
    } else if (['find_regulations','find_races'].includes(saved.kind) || id.startsWith('pair-')) {
      const receipt = applied[id];
      if (!receipt || receipt.at < saved.at) {
        report.waiting++;
        pushWaiting(id, saved.kind, 'awaiting_apply', saved.at);
      } else if (['applied','merged'].includes(receipt.outcome)) {
        report.inCatalogue++;
        report.publiclyVerified++;
      } else if (['held','conflict','failed','rejected','blocked'].includes(receipt.outcome)) {
        report.blocked++;
        pushBlocked(id, saved.kind, receipt.reason ?? receipt.outcome, receipt.at ?? saved.at);
      }
    }
  }
  report.waitingVerification = report.waiting;
  report.writtenToCatalogue = report.inCatalogue + report.localDetails + practicalWrites.length;
  report.waitingItems = sortOldestFirst(waitingItems).slice(0, 20);
  report.blockedItems = sortOldestFirst(blockedItems).slice(0, 20);
  return { report, practicalWrites };
}

function practicalCountsQuery(writes) {
  const payload = Buffer.from(JSON.stringify(writes)).toString('hex');
  return 'with wanted as (select * from jsonb_to_recordset(convert_from(decode(\'' + payload +
    '\',\'hex\'),\'UTF8\')::jsonb) as x(race uuid, fields jsonb)), checked as (select race, ' +
    'e.id is not null and not exists (select 1 from jsonb_each(wanted.fields) as f(key,value) ' +
    "where e.practical_details->f.key->'value' is distinct from f.value) as present " +
    "from wanted left join public.events e on e.id=race and e.visibility='public' and e.merged_into_id is null) " +
    "select json_build_object('published',count(*) filter (where present), 'local',count(*) filter (where not present)) from checked";
}

module.exports = { discoveryKeys, discoverySources, discoveryCountsQuery, discoverySiteCountsQuery, applyDiscoverySiteCounts, agentHealth, practicalCountsQuery };
