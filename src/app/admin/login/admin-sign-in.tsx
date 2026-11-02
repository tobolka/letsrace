"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * One way in: Google. The admin is an existing account on the owner list, so
 * there is nothing to register and no password form to offer.
 */
export function AdminSignIn({ signedInAs }: { signedInAs: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function google() {
    setBusy(true);
    setError("");
    const { error: err } = await createBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/admin")}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin</CardTitle>
        <CardDescription>
          {signedInAs ? `${signedInAs} is not an admin account.` : "Sign in with the admin's Google account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {signedInAs ? (
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void google()} disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            Sign in with Google
          </Button>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
