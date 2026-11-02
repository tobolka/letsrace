"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/account/auth-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function AdminSignIn({ signedInAs }: { signedInAs: string | null }) {
  const router = useRouter();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin</CardTitle>
        <CardDescription>
          {signedInAs
            ? `${signedInAs} is not an admin account. Sign out and sign in with an admin account.`
            : "Sign in with your Let's Race account to manage sources, races and organisers."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signedInAs ? (
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        ) : (
          <AuthForm locale="en" hideTitle onSuccess={() => router.refresh()} />
        )}
      </CardContent>
    </Card>
  );
}
