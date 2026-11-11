/**
 * Accept a reader repair without a person: the checks a reviewer would make, made by code.
 * The reader-repair agent runs this on its own branch when its work is done.
 *
 *   node scripts/reader-accept.cjs <branch> [--dry]
 *
 * The branch is merged into the branch checked out here, and the Mac's runner is updated, only if
 *   - it touches nothing but readers, their tests and their saved pages,
 *   - it adds or changes at least one test,
 *   - it deletes no test and no saved page,
 *   - the types check and the whole test suite passes on the merged result.
 * Anything else leaves the branch as it is and says why. Nothing is pushed from here.
 */
const cp = require('node:child_process'); const path = require('node:path');
const root = path.resolve(__dirname, '..');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 2 ** 26 }).trim();

/** What a reader repair may touch. */
const ALLOWED = [/^src\/lib\/watcher\/extractors\/[^/]+\.ts$/, /^src\/lib\/catalog\/[^/]+\.ts$/, /^src\/lib\/__tests__\/[^/]+\.test\.ts$/, /^src\/lib\/__tests__\/fixtures\/.+/, /^docs\/fixtures\/.+/];
const isTest = file => /^src\/lib\/__tests__\/[^/]+\.test\.ts$/.test(file);

/** Why these changed files may not be accepted, or nothing. `changes` are "status<TAB>path" lines of git diff --name-status. */
function refusal(changes) {
  const rows = changes.map(line => { const [status, ...rest] = line.split('\t'); return { status: status[0], file: rest.at(-1) }; }).filter(row => row.file);
  if (!rows.length) return 'the branch changes nothing';
  const outside = rows.filter(row => !ALLOWED.some(pattern => pattern.test(row.file)));
  if (outside.length) return `it touches files a reader repair may not: ${outside.slice(0, 5).map(row => row.file).join(', ')}`;
  const deleted = rows.filter(row => row.status === 'D' && (isTest(row.file) || /fixtures\//.test(row.file)));
  if (deleted.length) return `it deletes a test or a saved page: ${deleted.map(row => row.file).join(', ')}`;
  if (!rows.some(row => isTest(row.file) && row.status !== 'D')) return 'it adds or changes no test';
  if (!rows.some(row => /^src\/lib\/(watcher\/extractors|catalog)\//.test(row.file))) return 'it changes no reader';
  return null;
}

function main() {
  const branch = process.argv[2], dry = process.argv.includes('--dry');
  if (!branch || !/^agent\/reader-[a-z0-9.-]+$/.test(branch)) throw Error('Give the branch: agent/reader-<site>');
  const here = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (here === branch) throw Error('Check out the branch the repair should go into, not the repair itself');
  if (git('status', '--porcelain', '--untracked-files=no')) throw Error('There are uncommitted changes here; the repair cannot be merged over them');
  const base = git('merge-base', here, branch);
  const why = refusal(git('diff', '--name-status', `${base}..${branch}`).split('\n').filter(Boolean));
  if (why) { console.log(JSON.stringify({ accepted: false, why })); process.exitCode = 2; return; }
  if (dry) { console.log(JSON.stringify({ accepted: null, wouldMerge: branch, into: here })); return; }
  const before = git('rev-parse', 'HEAD');
  const undo = reason => { try { git('merge', '--abort'); } catch { /* nothing to abort */ } git('reset', '--hard', before); console.log(JSON.stringify({ accepted: false, why: reason })); process.exitCode = 2; };
  try { git('merge', '--no-ff', '--no-edit', '-m', `Merge reader repair ${branch} [no deploy]`, branch); } catch { return undo('it does not merge cleanly'); }
  // The merged result is what must hold, not the branch on its own.
  const run = (file, args) => cp.spawnSync(file, args, { cwd: root, encoding: 'utf8', maxBuffer: 2 ** 26, timeout: 20 * 60_000 });
  const types = run('npx', ['tsc', '--noEmit', '-p', '.']); if (types.status !== 0) return undo(`types do not check: ${(types.stdout || types.stderr).split('\n').filter(Boolean)[0]?.slice(0, 200)}`);
  const tests = run('npm', ['test', '--silent']); if (tests.status !== 0) return undo(`tests fail: ${(tests.stdout || '').split('\n').filter(line => /FAIL|failed/.test(line))[0]?.slice(0, 200) ?? 'see npm test'}`);
  // The Mac's runner works from its own copy; without this the repair would not read a single page.
  const installed = run(process.execPath, ['scripts/with-node.cjs', 'scripts/install-local-runner.cjs']);
  console.log(JSON.stringify({ accepted: true, merged: branch, into: here, commit: git('rev-parse', '--short', 'HEAD'), runnerUpdated: installed.status === 0 }));
}
module.exports = { refusal };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
