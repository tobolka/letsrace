"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useRouter } from "next/navigation";

export function AuthForm({
  locale,
  onSuccess,
  initialMode = "login",
  reason,
  hideTitle,
}: {
  locale: string;
  /** Called after successful sign-in/register with a session (stay on page). */
  onSuccess?: () => void;
  initialMode?: "login" | "register";
  reason?: string;
  hideTitle?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const supabase = createBrowserSupabase();

    if (mode === "register") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name || email.split("@")[0] } },
      });
      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      const uid = data.user?.id;
      if (uid) {
        await fetch("/api/account/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: uid,
            email,
            displayName: name || email.split("@")[0],
          }),
        });
      }
      if (!data.session) {
        setInfo("Check your email to confirm, then sign in.");
        setMode("login");
        setBusy(false);
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/${locale}/account`);
        router.refresh();
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/${locale}/account`);
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {!hideTitle ? (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "register" ? "Create account" : "Sign in"}
          </h1>
          {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
        </div>
      ) : null}
      <div className="flex gap-1">
        <Button
          type="button"
          variant={mode === "register" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("register")}
        >
          Register
        </Button>
        <Button
          type="button"
          variant={mode === "login" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("login")}
        >
          Sign in
        </Button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "register" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-name">Name</Label>
            <Input
              id="auth-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name…"
              autoComplete="name"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm">{info}</p> : null}
        <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
          {mode === "register" ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
