const assert = require('node:assert/strict');
const { collectionHealthQuery } = require('./local-collection-health.cjs');

const sql = collectionHealthQuery('CZ,SK');
assert.match(sql, /'CZ','SK'/);
assert.match(sql, /'broken',count\(\*\) filter\(where operational_state='broken'\)/);
assert.match(sql, /'brokenReaders'/);
assert.match(sql, /w\.operational_state = 'broken'/);
assert.match(sql, /w\.operational_state in \('unreadable', 'review'\)/);
assert.match(sql, /coalesce\(w\.last_error, ''\) not ilike '%identity_review_required%'/);
assert.match(sql, /coalesce\(w\.last_error, ''\) not ilike '%calendar_write_retry_pending%'/);
assert.doesNotMatch(sql, /w\.last_extract_status in \('needs_review','error'\)/);
assert.match(sql, /order by \(w\.operational_state = 'broken'\) desc, count\(distinct e\.id\) desc, w\.last_fetched_at desc nulls last/);
assert.match(sql, /order by \(r\.state = 'broken'\) desc, r\.races desc, r\.last_fetched_at desc nulls last/);
assert.match(sql, /portal\.czechcyclingfederation\.com\/Races/);
assert.match(sql, /'upcoming10m'/);
assert.match(sql, /current_date\+300/);
assert.match(sql, /practical_details \?\| array\['venue','routes','fees','schedule','categories'\]/);
assert.match(sql, /'nearby'/);
assert.match(sql, /'sources'/);

assert.throws(() => collectionHealthQuery('CZ,INVALID'), /Invalid catalogue countries/);
assert.throws(() => collectionHealthQuery('cz'), /Invalid catalogue countries/);
assert.throws(() => collectionHealthQuery(''), /Invalid catalogue countries/);

console.log('PASS: collectionHealthQuery generates brokenReaders and upcoming10m SQL and validates countries');
