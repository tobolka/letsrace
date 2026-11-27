const assert = require('node:assert/strict');
const { collectionHealthQuery } = require('./local-collection-health.cjs');

const sql = collectionHealthQuery('CZ,SK');
assert.match(sql, /'CZ','SK'/);
assert.match(sql, /'broken',count\(\*\) filter\(where operational_state='broken'\)/);
assert.match(sql, /'brokenReaders'/);
assert.match(sql, /operational_state in \('broken','unreadable','review'\) or w\.last_extract_status in \('needs_review','error'\)/);
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
