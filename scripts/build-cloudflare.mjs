import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

// These are public settings, shared by the client build and Worker runtime.
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"))
const result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  env: { ...process.env, ...config.vars },
  shell: process.platform === "win32",
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
