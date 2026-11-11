/**
 * Version 2, first lane: regulations links, from queue task to decided proposal.
 *
 * This process holds the database access and never reads anyone's website. For each task it
 * takes, it writes the task to a file and starts scripts/find-documents-task.ts with an
 * environment built here: no keys, no .env.local, and the local guard that stops any request
 * to our own server. What comes back is checked as data, handed in with the task in one
 * transaction, and decided by pipeline_apply_proposal.
 *
 *   tsx scripts/pipeline2-find-documents.ts --psql=<scratch database> [--sites=30] [--countries=CZ,SK] [--days=90] [--events=id,id] [--out=report.json]
 *   tsx scripts/pipeline2-find-documents.ts --server …        (needs the two migrations applied)
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { siteOf } from "../src/lib/catalog/site-documents";
import { psqlDb, serverDb, type FindDocumentsDb, type Race, type Task } from "../src/lib/pipeline2/find-documents-db";
import { checkReaderOutput, failuresInARow, nextAttempt, type Ended } from "../src/lib/pipeline2/queue";

const root = resolve(__dirname, "..");
const TASK_SECONDS = 200, KILL_AFTER_MS = 240_000; // the queue's lease is five minutes
const AGAIN_AFTER_SECONDS = 24 * 3600;

/** Start the reader with nothing of ours in its environment, and wait for it within the limit. */
function read(taskFile: string, outFile: string): Promise<{ code: number | null; timedOut: boolean; stderr: string }> {
  return new Promise(done => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TMPDIR: process.env.TMPDIR ?? tmpdir(), LC_ALL: "en_US.UTF-8",
      // The guard refuses any request to our server, mail or hosting; it wants a local address to exist.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NODE_OPTIONS: `--require "${join(root, "scripts/local-guard.cjs")}"`,
    };
    const child = spawn(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/find-documents-task.ts"), `--task=${taskFile}`, `--out=${outFile}`], { cwd: root, env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "", timedOut = false;
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-2000); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, KILL_AFTER_MS);
    child.once("close", code => { clearTimeout(timer); done({ code, timedOut, stderr }); });
    child.once("error", error => { clearTimeout(timer); done({ code: null, timedOut, stderr: error.message }); });
  });
}

async function main() {
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  let db: FindDocumentsDb;
  if (arg("psql")) db = psqlDb(arg("psql")!);
  else if (process.argv.includes("--server")) {
    const { parse } = await import("dotenv");
    // On the Mac the values are in .env.local; a cloud runner has them in its environment already.
    for (const [key, value] of Object.entries(parse(await readFile(join(root, ".env.local"), "utf8").catch(() => "")))) process.env[key] ??= value;
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const client = createServerSupabase();
    db = serverDb(client as never);
    // A second worker stands in only while the first is silent: --unless-heard=mac:30 does nothing if "mac" reported within 30 minutes.
    const guard = arg("unless-heard")?.split(":");
    if (guard?.[0]) {
      const { data, error } = await (client as unknown as { from(table: string): { select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: { heartbeat_at: string | null; paused: boolean | null } | null; error: { message: string } | null }> } } } }).from("pipeline_workers").select("heartbeat_at,paused").eq("key", guard[0]).maybeSingle();
      if (error) throw Error(error.message);
      const silentMinutes = data?.heartbeat_at ? (Date.now() - Date.parse(data.heartbeat_at)) / 60_000 : Infinity;
      if (silentMinutes < Number(guard[1] ?? 30)) { console.log(JSON.stringify({ ran: false, why: `${guard[0]} reported ${Math.round(silentMinutes)} minutes ago` })); return; }
    }
  } else throw Error("Say where: --psql=<scratch database on this Mac> or --server");

  const limit = Number(arg("sites") ?? 20), days = Number(arg("days") ?? 0);
  const countries = arg("countries")?.split(","), only = arg("events")?.split(",");
  const until = days ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) : null;
  const wanted = (await db.races()).filter(race => (!countries || countries.includes(race.country_code ?? "")) && (!until || race.start_date <= until) && (!only || only.includes(race.id)));
  const bySite = new Map<string, Race[]>();
  for (const race of wanted) { const site = siteOf(race.website_url); if (site) bySite.set(site, [...(bySite.get(site) ?? []), race]); }
  const sites = [...bySite.keys()].slice(0, limit);
  const queued = await db.queue(sites, AGAIN_AFTER_SECONDS);

  const directory = await mkdtemp(join(tmpdir(), "letsrace-find-documents-"));
  const report = { at: new Date().toISOString(), racesWanted: wanted.length, sitesKnown: bySite.size, sitesAsked: sites.length, queued, tasks: [] as object[], totals: {} as Record<string, number> };
  const add = (key: string, n = 1) => { report.totals[key] = (report.totals[key] ?? 0) + n; };
  try {
    for (let taken = 0; taken < limit;) {
      // One at a time: a task's five-minute lease starts when it is taken, not when its turn comes.
      const [task] = await db.claim(1) as Task[];
      if (!task) break;
      taken++;
      const races = bySite.get(task.payload.site) ?? [];
      const started = Date.now();
      const entry: Record<string, unknown> = { site: task.payload.site, races: races.length };
      report.tasks.push(entry);
      let ended: Ended, proposals: object[] = [], stats: object | undefined;
      if (!races.length) ended = { outcome: "waiting", reason: "no_document_yet" }; // filled or hidden since it was queued
      else {
        const taskFile = join(directory, `task-${taken}.json`), outFile = join(directory, `out-${taken}.json`);
        await writeFile(taskFile, JSON.stringify({ site: task.payload.site, seconds: TASK_SECONDS, races: races.map(({ id, name, start_date, website_url, municipality }) => ({ id, name, start_date, website_url, municipality })) }));
        const ran = await read(taskFile, outFile);
        const raw = await readFile(outFile, "utf8").then(JSON.parse).catch(() => null);
        const checked = raw ? checkReaderOutput(raw, { eventIds: races.map(race => race.id), fields: ["regulations_url"], reader: "site_documents" }) : null;
        if (ran.timedOut) ended = { outcome: "timeout", reason: "timeout" };
        else if (!checked) { ended = { outcome: "failed", reason: "crashed" }; entry.error = ran.stderr.split("\n").filter(Boolean).at(-1)?.slice(0, 200); }
        else if (!checked.ok) { ended = { outcome: "failed", reason: "bad_output" }; entry.error = checked.why; }
        else { ended = { outcome: checked.output.outcome, reason: checked.output.reason }; proposals = checked.output.proposals; stats = checked.output.stats; }
      }
      entry.outcome = ended.outcome; entry.reason = ended.reason; entry.stats = stats; entry.seconds = Math.round((Date.now() - started) / 100) / 10;
      add(`task_${ended.outcome}`);

      if (["done", "partial", "waiting"].includes(ended.outcome)) {
        // The site was read. What it gave is handed in with the task, or not at all.
        const finished = await db.finish(task, { ...ended, stats }, proposals);
        entry.accepted = finished.accepted; if (!finished.accepted) { entry.refused = finished.reason; add("handin_refused"); continue; }
        entry.decisions = [];
        for (const key of finished.proposals ?? []) {
          const decision = await db.apply(key);
          (entry.decisions as object[]).push({ key, ...decision });
          add(`proposal_${decision.status}${decision.reason ? `_${decision.reason}` : ""}`);
        }
      } else {
        const next = nextAttempt(ended, failuresInARow(await db.attempts(task.key)), { usualSeconds: AGAIN_AFTER_SECONDS });
        entry.nextTryInSeconds = next.delaySeconds; entry.failures = next.failures; if (next.stopped) entry.stopped = true;
        await db.retry(task, `${ended.outcome}:${ended.reason ?? ""}`, next.delaySeconds);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
  if (arg("out")) await writeFile(arg("out")!, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, tasks: report.tasks.length }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
