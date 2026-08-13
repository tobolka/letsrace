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
}: {
  locale: string;
  /** Called after successful sign-in/register with a session (stay on page). */
  onSuccess?: () => void;
  initialMode?: "login" | "register";
  reason?: string;
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
    <div className={onSuccess ? "" : "mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"}>
      <h1 className="font-sans tracking-tight text-2xl font-semibold">
        {mode === "register" ? "Create account" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        {reason || "Track races for you and your kids — favorites, calendar, paid / registered."}
      </p>
      <div className="mt-4 flex gap-2 text-sm">
        <button
          type="button"
          className={mode === "register" ? "font-semibold text-stone-900" : "text-stone-500"}
          onClick={() => setMode("register")}
        >
          Register
        </button>
        <span className="text-stone-300">·</span>
        <button
          type="button"
          className={mode === "login" ? "font-semibold text-stone-900" : "text-stone-500"}
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        {mode === "register" && (
          <div className="space-y-1">
            <Label>Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dad / name" />
          </div>
        )}
        <div className="space-y-1">
          <Label>Email</Label>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Password</Label>
          <Input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-stone-900">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : mode === "register" ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
