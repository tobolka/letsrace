/**
 * The seven database calls the find-documents dispatcher makes, behind one small interface, so
 * the same dispatcher runs against the server (service role) and against a scratch copy on the
 * Mac (psql) for a shadow run. Every call is one of the functions in supabase/migrations/2026111115*.
 */
import { execFileSync } from "node:child_process";

export type Race = { id: string; name: string; start_date: string; website_url: string; municipality: string | null; country_code: string | null };
export type Task = { key: string; token: string; payload: { site: string }; attempts: number };
export type Finished = { accepted: boolean; reason?: string; proposals?: string[] };
export type Decision = { status: string; reason: string | null; repeated?: boolean };

export type FindDocumentsDb = {
  races(): Promise<Race[]>;
  queue(sites: string[], againAfterSeconds: number): Promise<number>;
  claim(limit: number): Promise<Task[]>;
  attempts(key: string): Promise<{ outcome: string | null; error: string | null }[]>;
  finish(task: Task, result: object, proposals: object[]): Promise<Finished>;
  retry(task: Task, error: string, delaySeconds: number): Promise<boolean>;
  apply(proposalKey: string): Promise<Decision>;
};

const text = (value: string) => `'${value.replace(/'/g, "''")}'`;
const json = (value: unknown) => `${text(JSON.stringify(value))}::jsonb`;

/** A database on this Mac's own PostgreSQL, by name. Used for shadow runs on a scratch copy. */
export function psqlDb(database: string, opts: { bin?: string; port?: string } = {}): FindDocumentsDb {
  const bin = opts.bin ?? process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
  const run = <T>(sql: string): T => JSON.parse(execFileSync(`${bin}/psql`, ["-h", "127.0.0.1", "-p", opts.port ?? "54329", "-U", "postgres", "-d", database, "-qAt", "-v", "ON_ERROR_STOP=1", "-c", `set role service_role; ${sql}`],
    { encoding: "utf8", maxBuffer: 2 ** 28, env: { NODE_ENV: "production", PATH: process.env.PATH ?? "", LC_ALL: "en_US.UTF-8", PGTZ: "UTC" } as NodeJS.ProcessEnv }).trim() || "null");
  return {
    races: async () => run("select coalesce(json_agg(r),'[]') from public.pipeline_find_documents_races() r"),
    queue: async (sites, again) => run(`select public.pipeline_queue_find_documents(array[${sites.map(text).join(",") || "''"}]::text[],${Math.round(again)})`),
    claim: async limit => run(`select coalesce(json_agg(r),'[]') from public.pipeline_claim_tasks('find_documents',array['http'],${Math.round(limit)}) r`),
    attempts: async key => run(`select coalesce(json_agg(json_build_object('outcome',outcome,'error',error) order by started_at),'[]') from public.pipeline_task_attempts where task_key=${text(key)}`),
    finish: async (task, result, proposals) => run(`select public.pipeline_finish_with_proposals(${text(task.key)},${text(task.token)}::uuid,${json(task.payload)},${json(result)},${json(proposals)})`),
    retry: async (task, error, delay) => run(`select to_json(public.pipeline_retry_task(${text(task.key)},${text(task.token)}::uuid,${text(error)},${Math.round(delay)}))`),
    apply: async key => run(`select public.pipeline_apply_proposal(${text(key)})`),
  };
}

type Rpc = { rpc(name: string, params?: object): PromiseLike<{ data: unknown; error: { message: string } | null }>; from(table: string): { select(columns: string): { eq(column: string, value: string): { order(column: string): PromiseLike<{ data: { outcome: string | null; error: string | null }[] | null; error: { message: string } | null }> } } } };

/** The server, with the service role. Refuses to start work the server has no functions for. */
export function serverDb(client: Rpc): FindDocumentsDb {
  const call = async <T>(name: string, params?: object): Promise<T> => {
    const { data, error } = await client.rpc(name, params);
    if (error) throw Error(`${name}: ${error.message}`);
    return data as T;
  };
  return {
    races: () => call("pipeline_find_documents_races"),
    queue: (sites, again) => call("pipeline_queue_find_documents", { p_sites: sites, p_again_after_seconds: Math.round(again) }),
    claim: limit => call("pipeline_claim_tasks", { p_kind: "find_documents", p_capabilities: ["http"], p_limit: limit }),
    attempts: async key => {
      const { data, error } = await client.from("pipeline_task_attempts").select("outcome,error").eq("task_key", key).order("started_at");
      if (error) throw Error(error.message);
      return data ?? [];
    },
    finish: (task, result, proposals) => call("pipeline_finish_with_proposals", { p_key: task.key, p_token: task.token, p_payload: task.payload, p_result: result, p_proposals: proposals }),
    retry: (task, error, delay) => call("pipeline_retry_task", { p_key: task.key, p_token: task.token, p_error: error, p_delay_seconds: Math.round(delay) }),
    apply: key => call("pipeline_apply_proposal", { p_key: key }),
  };
}
