import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = Record<string, unknown>;

/** Server client. Prefers service role (bypasses RLS) for admin/watcher writes. */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(url, serviceKey || anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
