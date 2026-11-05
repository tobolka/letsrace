/**
 * Read races' own websites for details missing from the catalogue, on the Mac and against its
 * copy. Start it through scripts/local-run.sh, whose guard keeps it away from the server; what
 * it finds is sent later by scripts/local-fills.cjs, and only into fields still empty there.
 */
import { readRaceSitesForDetails } from "../src/lib/catalog/hygiene";

if (process.env.LETSRACE_LOCAL_PASS !== "1") throw Error("Start this through scripts/local-run.sh");
const number = (name: string, fallback: number) => Number(process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const scale = number("scale", 1);
readRaceSitesForDetails({ fci: 40 * scale, timing: 30 * scale, regulations: 20 * scale, websites: 30 * scale, austria: 30 * scale, registration: 30 * scale }).then(result => {
  console.log(`local_catalog_fills ${JSON.stringify(result)}`);
  process.exit(0);
}).catch(error => { console.error(error); process.exit(1); });
