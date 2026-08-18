/**
 * Re-exec the given command on Node 22+ (nvm) so supabase-js stops warning.
 * Usage: node scripts/with-node.cjs next dev
 */
const { spawn } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");

require("./copy-maplibre-worker.cjs");
const { homedir } = require("node:os");
const { delimiter, dirname, join } = require("node:path");

function major(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function findNode22() {
  if (major(process.versions.node) >= 22) return process.execPath;
  const nvmRoot = join(homedir(), ".nvm/versions/node");
  if (!existsSync(nvmRoot)) return null;
  const versions = readdirSync(nvmRoot)
    .filter((name) => name.startsWith("v22."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const latest = versions.at(-1);
  if (!latest) return null;
  const bin = join(nvmRoot, latest, "bin/node");
  return existsSync(bin) ? bin : null;
}

const node = findNode22();
const [cmd, ...rest] = process.argv.slice(2);
if (!node) {
  console.error(
    `Need Node 22+ (now ${process.version}). Install with: nvm install 22 && nvm use`,
  );
  process.exit(1);
}
if (!cmd) {
  console.error("Usage: node scripts/with-node.cjs <command> [...args]");
  process.exit(1);
}

const resolved =
  cmd === "next" ? require.resolve("next/dist/bin/next") : cmd;
const env = {
  ...process.env,
  PATH: `${dirname(node)}${delimiter}${process.env.PATH ?? ""}`,
};

const child = spawn(node, [resolved, ...rest], { stdio: "inherit", env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
