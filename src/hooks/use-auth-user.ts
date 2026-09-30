"use client";

import { useEffect, useState } from "react";

export type AuthUser = { authed: boolean | null; email: string | null };

/**
 * Who is signed in, or `authed: null` while nobody knows yet.
 *
 * The auth client is a quarter of a megabyte and nothing on screen needs it
 * until we know who is signed in, so it is fetched after the page is up rather
 * than shipped with it.
 */
export function useAuthUser(): AuthUser {
  const [state, setState] = useState<AuthUser>({ authed: null, email: null });

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      if (!alive) return;
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setState({ authed: Boolean(data.user), email: data.user?.email ?? null });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (alive) setState({ authed: Boolean(session?.user), email: session?.user?.email ?? null });
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      if (!alive) unsubscribe();
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}
