import fs from 'node:fs';
import { parse } from 'dotenv';
Object.assign(process.env, parse(fs.readFileSync('.env.local')));
async function main() {
  const { getSourceHealth } = await import('../../src/lib/admin/source-health');
  const { getAdminWorkCounts } = await import('../../src/lib/admin/work-counts');
  const [health, work] = await Promise.all([getSourceHealth(), getAdminWorkCounts()]);
  const reasons: Record<string, number> = {};
  for (const source of health.stalled) reasons[source.reason] = (reasons[source.reason] ?? 0) + 1;
  fs.writeFileSync('reports/operations-seo-2026-11-01/admin-remaining.json', JSON.stringify({ at: new Date().toISOString(), work, reasons, sources: health.stalled }, null, 2));
  console.log({ work, reasons });
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
