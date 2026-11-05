/**
 * What did a local pass change? Compares the working copy with its untouched twin,
 * row by row, using each table's primary key. Reads only, and only on this computer.
 *
 *   node scripts/local-diff.cjs [--out=file.json] [--rows]
 */
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');

const PSQL = process.env.LOCAL_PG_BIN ? `${process.env.LOCAL_PG_BIN}/psql` : '/opt/homebrew/opt/postgresql@17/bin/psql';
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const query = (database, sql) => execFileSync(PSQL, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', database, '-qAt', '-c', sql],
  { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, env: { ...process.env, LC_ALL: 'en_US.UTF-8' } });

const tables = JSON.parse(query('letsrace', `select coalesce(json_agg(json_build_object('schema', n.nspname, 'table', c.relname,
    'key', (select json_agg(a.attname order by k.ord) from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum where i.indrelid = c.oid and i.indisprimary))), '[]')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'pipeline_private') and c.relkind = 'r' and c.relname <> 'spatial_ref_sys'`));

const rowsOf = (database, { schema, table, key }) => {
  const name = `"${schema}"."${table}"`;
  const id = key.map(column => `t."${column}"::text`).join(`|| chr(31) ||`);
  const lines = query(database, `select coalesce(json_object_agg(${id}, to_jsonb(t)), '{}') from ${name} t`);
  return JSON.parse(lines);
};

const report = [];
for (const entry of tables) {
  const label = `${entry.schema}.${entry.table}`;
  if (!entry.key) { report.push({ table: label, skipped: 'no primary key' }); continue; }
  const before = rowsOf('letsrace_baseline', entry), after = rowsOf('letsrace', entry);
  const inserted = Object.keys(after).filter(id => !(id in before));
  const deleted = Object.keys(before).filter(id => !(id in after));
  const updated = [], columns = {};
  for (const id of Object.keys(after)) {
    if (!(id in before)) continue;
    const changed = Object.keys(after[id]).filter(column => JSON.stringify(after[id][column]) !== JSON.stringify(before[id][column]));
    if (!changed.length) continue;
    updated.push(id);
    for (const column of changed) columns[column] = (columns[column] ?? 0) + 1;
  }
  if (inserted.length || deleted.length || updated.length) report.push({ table: label, inserted: inserted.length, updated: updated.length, deleted: deleted.length, columns,
    ...(process.argv.includes('--rows') ? { insertedIds: inserted.slice(0, 50), updatedIds: updated.slice(0, 50), deletedIds: deleted.slice(0, 50) } : {}) });
}
const out = arg('out');
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
