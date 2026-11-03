import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const { requestPublicRefreshes } = await import("../src/lib/pipeline/public-refresh-requests");
  const result = await requestPublicRefreshes();
  console.log(result);
  if (result.status === "deferred") process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Refresh failed"); process.exitCode = 1; });
