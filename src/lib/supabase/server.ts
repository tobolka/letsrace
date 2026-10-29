import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { boundedDatabaseFetch, databaseDeadline } from "./request-budget";

export type { Database };

/** Server client. Prefers service role (bypasses RLS) for admin/watcher writes. */
export function createServerSupabase(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient<Database>(url, serviceKey || anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedDatabaseFetch },
    // A collector resumes at the source level. Retrying writes here can duplicate
    // inserts after an ambiguous network failure and outlive the source budget.
    ...(databaseDeadline() == null ? {} : { db: { retry: false } }),
  });
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
