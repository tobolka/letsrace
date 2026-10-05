import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  const { fillRegistrationAgeEvidence } = await import("../src/lib/catalog/registration-ages");
  console.log(await fillRegistrationAgeEvidence({ max: 400, dryRun: process.argv.includes("--dry"), log: console.log }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
