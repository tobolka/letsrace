/**
 * The Mac's own working database for big passes. Everything between one catalogue
 * snapshot and a final batch of results lives here, so reading and judging any
 * number of pages costs the server nothing and survives a crash or a closed lid.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";

const SCHEMA = `
create table if not exists meta (key text primary key, value text not null);
create table if not exists catalogue_events (
  id text primary key, name text not null, start_date text not null, end_date text, status text, visibility text,
  event_type text, series_id text, disciplines text, website_url text, lat real, lng real, municipality text, country_code text
);
create index if not exists catalogue_events_date on catalogue_events(start_date);
create table if not exists catalogue_sources (event_id text not null, watched_url_id text, external_id text, source_url text);
create index if not exists catalogue_sources_key on catalogue_sources(watched_url_id, external_id);
create table if not exists sources (
  url text primary key, origin text not null, kind text, watched_url_id text, state text not null default 'pending',
  attempts integer not null default 0, next_try_at integer not null default 0, http_status integer, last_error text,
  read_at integer, hash text, content_type text, body blob,
  extracted_hash text, strategy text, parsed_count integer, complete integer, extract_error text
);
create index if not exists sources_due on sources(state, next_try_at);
create table if not exists parsed_events (
  url text not null, external_id text not null, start_date text not null, payload text not null, primary key (url, external_id)
);
create table if not exists findings (
  url text not null, external_id text not null, decision text not null, event_id text, reason text, name text, start_date text,
  primary key (url, external_id)
);
`;

export type SourceState = "pending" | "ok" | "gone" | "error" | "unsupported";
export type SourceRow = { url: string; origin: string; kind: string | null; watched_url_id: string | null; state: SourceState; attempts: number };
export type CatalogueEvent = {
  id: string; name: string; start_date: string; end_date: string | null; status: string | null; visibility: string | null;
  event_type: string | null; series_id: string | null; disciplines: string[] | null; website_url: string | null;
  lat: number | null; lng: number | null; municipality: string | null; country_code: string | null;
};

export const localPassDirectory = () =>
  process.env.LETSRACE_LOCAL_PASS_DIR ?? join(homedir(), "Library", "Application Support", "LetsRace", "data", "local-pass");

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return url; } };

export function openStore(directory = localPassDirectory()) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "pass.sqlite"));
  db.exec("pragma journal_mode = wal; pragma synchronous = normal; pragma busy_timeout = 10000;");
  db.exec(SCHEMA);

  const transaction = (work: () => void) => {
    db.exec("begin immediate");
    try { work(); db.exec("commit"); } catch (error) { db.exec("rollback"); throw error; }
  };
  const meta = (key: string) => (db.prepare("select value from meta where key = ?").get(key) as { value: string } | undefined)?.value;
  const setMeta = (key: string, value: string) => { db.prepare("insert into meta values (?, ?) on conflict(key) do update set value = excluded.value").run(key, value); };

  return {
    directory, transaction, meta, setMeta,
    close: () => db.close(),

    /** One pass at a time; a lock left by a crashed process does not block the next one. */
    acquireLock(pid = process.pid, alive = (other: number) => { try { process.kill(other, 0); return true; } catch { return false; } }) {
      const held = Number(meta("lock_pid"));
      if (held && held !== pid && alive(held)) throw Error(`Another local pass is running (pid ${held})`);
      setMeta("lock_pid", String(pid));
    },
    releaseLock() { db.prepare("delete from meta where key = 'lock_pid'").run(); },

    replaceCatalogue(events: CatalogueEvent[], sources: { event_id: string; watched_url_id: string | null; external_id: string | null; source_url: string | null }[], at = new Date().toISOString()) {
      transaction(() => {
        db.exec("delete from catalogue_events; delete from catalogue_sources;");
        const addEvent = db.prepare("insert into catalogue_events values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        for (const e of events) addEvent.run(e.id, e.name, e.start_date, e.end_date, e.status, e.visibility, e.event_type, e.series_id, JSON.stringify(e.disciplines ?? []), e.website_url, e.lat, e.lng, e.municipality, e.country_code);
        const addSource = db.prepare("insert into catalogue_sources values (?,?,?,?)");
        for (const s of sources) addSource.run(s.event_id, s.watched_url_id, s.external_id, s.source_url);
        setMeta("snapshot_at", at);
      });
    },
    catalogue(): CatalogueEvent[] {
      return (db.prepare("select * from catalogue_events").all() as (Omit<CatalogueEvent, "disciplines"> & { disciplines: string })[])
        .map(row => ({ ...row, disciplines: JSON.parse(row.disciplines) as string[] }));
    },
    sourceKeys() {
      return db.prepare("select event_id, watched_url_id, external_id, source_url from catalogue_sources").all() as { event_id: string; watched_url_id: string | null; external_id: string | null; source_url: string | null }[];
    },

    /** Adding a source again keeps what is already known about it, so a re-run resumes. */
    addSources(rows: { url: string; origin: string; kind?: string | null; watched_url_id?: string | null }[]) {
      transaction(() => {
        const add = db.prepare("insert into sources (url, origin, kind, watched_url_id) values (?,?,?,?) on conflict(url) do update set kind = coalesce(excluded.kind, kind), watched_url_id = coalesce(excluded.watched_url_id, watched_url_id)");
        for (const r of rows) add.run(r.url, r.origin, r.kind ?? null, r.watched_url_id ?? null);
      });
    },
    /** Sources due for reading: never read, or last read before `olderThan`, and past any retry wait. */
    dueSources(now: number, olderThan: number): SourceRow[] {
      return db.prepare(`select url, origin, kind, watched_url_id, state, attempts from sources
        where next_try_at <= ? and (read_at is null or read_at < ?) order by read_at is not null, read_at, url`).all(now, olderThan) as SourceRow[];
    },
    saveRead(url: string, read: { html: string; status: number; hash: string; contentType?: string | null }, now: number) {
      db.prepare("update sources set state='ok', attempts=0, next_try_at=0, http_status=?, last_error=null, read_at=?, hash=?, content_type=?, body=? where url=?")
        .run(read.status, now, read.hash, read.contentType ?? null, gzipSync(read.html), url);
    },
    /** Gone pages and failures keep their earlier body and wait; they never count as "no race here". */
    saveFailure(url: string, failure: { state: SourceState; status?: number; error?: string }, now: number) {
      const row = db.prepare("select attempts from sources where url = ?").get(url) as { attempts: number } | undefined;
      const attempts = (row?.attempts ?? 0) + 1;
      const wait = failure.state === "error" ? Math.min(2 ** attempts, 24) * 3600_000 : 7 * 24 * 3600_000;
      db.prepare("update sources set state=?, attempts=?, next_try_at=?, http_status=?, last_error=? where url=?")
        .run(failure.state, attempts, now + wait, failure.status ?? null, failure.error?.slice(0, 500) ?? null, url);
    },
    sourcesToExtract(version: string): { url: string; hash: string; body: Uint8Array; watched_url_id: string | null; origin: string }[] {
      return db.prepare("select url, hash, body, watched_url_id, origin from sources where state='ok' and body is not null and (extracted_hash is null or extracted_hash <> ? || hash)").all(version) as never;
    },
    saveExtraction(url: string, version: string, hash: string, result: { strategy: string; complete: boolean; events: { externalId: string; startDate: string }[] }) {
      transaction(() => {
        db.prepare("delete from parsed_events where url = ?").run(url);
        const add = db.prepare("insert or replace into parsed_events values (?,?,?,?)");
        for (const e of result.events) add.run(url, e.externalId, e.startDate, JSON.stringify(e));
        db.prepare("update sources set extracted_hash=?, strategy=?, parsed_count=?, complete=?, extract_error=null where url=?")
          .run(version + hash, result.strategy, result.events.length, result.complete ? 1 : 0, url);
      });
    },
    saveExtractionFailure(url: string, error: string) {
      db.prepare("update sources set extract_error=? where url=?").run(error.slice(0, 500), url);
    },
    parsedEvents(from: string, until: string) {
      return (db.prepare("select p.url, p.payload, s.watched_url_id, s.origin from parsed_events p join sources s on s.url = p.url where p.start_date between ? and ?").all(from, until) as { url: string; payload: string; watched_url_id: string | null; origin: string }[])
        .map(row => ({ ...row, event: JSON.parse(row.payload) as Record<string, unknown> }));
    },
    pageText(url: string): string | null {
      const row = db.prepare("select body from sources where url = ?").get(url) as { body: Uint8Array | null } | undefined;
      return row?.body ? gunzipSync(row.body).toString("utf8") : null;
    },
    sourceSummary() {
      return db.prepare("select origin, state, count(*) n, sum(coalesce(parsed_count,0)) parsed from sources group by 1,2 order by 1,2").all() as { origin: string; state: string; n: number; parsed: number }[];
    },
    failures(limit = 40) {
      return db.prepare("select url, state, http_status, coalesce(last_error, extract_error) error from sources where state in ('error') or extract_error is not null order by url limit ?").all(limit) as { url: string; state: string; http_status: number | null; error: string | null }[];
    },
    saveFindings(rows: { url: string; externalId: string; decision: string; eventId?: string | null; reason?: string | null; name: string; startDate: string }[]) {
      transaction(() => {
        db.exec("delete from findings");
        const add = db.prepare("insert or replace into findings values (?,?,?,?,?,?,?)");
        for (const r of rows) add.run(r.url, r.externalId, r.decision, r.eventId ?? null, r.reason ?? null, r.name, r.startDate);
      });
    },
  };
}
export type LocalStore = ReturnType<typeof openStore>;

/**
 * Next due source whose host is free. One request at a time per organiser, however
 * many workers the Mac can run: their limits are not ours to spend.
 */
export function nextForFreeHost<T extends { url: string }>(queue: T[], busy: Set<string>): T | undefined {
  const index = queue.findIndex(item => !busy.has(hostOf(item.url)));
  return index < 0 ? undefined : queue.splice(index, 1)[0];
}
export { hostOf };
