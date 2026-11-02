import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { publishCatalogueBatch } from "../src/lib/pipeline/catalogue-publication";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const result = await publishCatalogueBatch();
  console.log(result);
  if (["deferred", "superseded"].includes(result.status)) process.exitCode = 2;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
