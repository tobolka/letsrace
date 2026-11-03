import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { completePlanChanges } from "../src/lib/pipeline/plan-changes";
async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const result = await completePlanChanges();
  console.log(JSON.stringify(result));
  if (result.deferred) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
