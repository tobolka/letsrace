"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { messagesFor } from "@/lib/i18n/messages";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden data-icon="inline-start">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.37l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Loaded on submit rather than imported, so the auth client does not ride along
 * with the map on every first visit. Both entry points here are already async
 * and already show a spinner while they work.
 */
async function browserSupabase() {
  const { createBrowserSupabase } = await import("@/lib/supabase/browser");
  return createBrowserSupabase();
}

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
  const t = messagesFor(locale);
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  async function onGoogle() {
    setBusy("google");
    setError("");
    setInfo("");
    const supabase = await browserSupabase();
    const origin = window.location.origin;
    const next = `${window.location.pathname}${window.location.search}`;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("email");
    setError("");
    setInfo("");
    const supabase = await browserSupabase();
    const emailValue = email.trim();

    if (mode === "register") {
      const { data, error: err } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: { data: { display_name: name.trim() || emailValue.split("@")[0] } },
      });
      if (err) {
        setError(err.message);
        setBusy(null);
        return;
      }
      const uid = data.user?.id;
      if (uid && data.session) {
        await fetch("/api/account/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name.trim() || emailValue.split("@")[0],
          }),
        });
      }
      if (!data.session) {
        setInfo(t.checkEmailConfirm);
        setMode("login");
        setBusy(null);
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/${locale}/account`);
        router.refresh();
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password,
      });
      if (err) {
        setError(err.message);
        setBusy(null);
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/${locale}/account`);
        router.refresh();
      }
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {!hideTitle ? (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "register" ? t.createAccount : t.signIn}
          </h1>
          {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
        </div>
      ) : null}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={mode}
        onValueChange={(v) => {
          if (v) setMode(v as "login" | "register");
        }}
      >
        <ToggleGroupItem value="register">{t.createAccount}</ToggleGroupItem>
        <ToggleGroupItem value="login">{t.signIn}</ToggleGroupItem>
      </ToggleGroup>
      <form
        method="post"
        autoComplete="on"
        name={mode === "register" ? "register" : "login"}
        onSubmit={(e) => void onSubmit(e)}
      >
        <FieldGroup className="gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy !== null}
            aria-busy={busy === "google"}
            onClick={() => void onGoogle()}
          >
            {busy === "google" ? <Spinner data-icon="inline-start" /> : <GoogleMark />}
            {t.continueWithGoogle}
          </Button>
          <FieldSeparator>{t.orEmail}</FieldSeparator>
          {mode === "register" ? (
            <Field>
              <FieldLabel htmlFor="name">{t.fieldName}</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex…"
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="email">{t.fieldEmail}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete={mode === "register" ? "email" : "username"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t.fieldPassword}</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <FieldError>{error}</FieldError> : null}
          {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
          <Button type="submit" className="w-full" disabled={busy !== null} aria-busy={busy === "email"}>
            {busy === "email" ? <Spinner data-icon="inline-start" /> : null}
            {mode === "register" ? t.createAccount : t.signIn}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
