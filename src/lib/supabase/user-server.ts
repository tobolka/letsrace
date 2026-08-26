import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/** Cookie-bound Supabase client (anon key + user session). Honors RLS. */
export async function createUserServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const jar = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            jar.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — ignore writable cookie errors.
        }
      },
    },
  });
}

export async function requireSessionUser(): Promise<User | null> {
  const supabase = await createUserServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
