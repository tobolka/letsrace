import { readFileSync } from "node:fs";
async function main(){
const { parseEndureEvents } = await import("../../src/lib/watcher/extractors/endure");
const ev = parseEndureEvents(readFileSync("/tmp/claude-501/endure/events.json","utf8"));
console.log(ev.length);
for (const e of ev.filter(e=>["DE","AT"].includes(e.countryHint!))) console.log(e.startDate, e.countryHint, (e.eventType??"race").padEnd(5), JSON.stringify(e.discipline).padEnd(28), e.name.slice(0,45));
}

main();
