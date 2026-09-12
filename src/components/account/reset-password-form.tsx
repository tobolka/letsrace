"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { messagesFor } from "@/lib/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirmation) {
      setError(t.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      const { error } = await createBrowserSupabase().auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setPassword("");
      setConfirmation("");
      setDone(true);
    } catch {
      setError(t.connectionFailed);
    } finally {
      setBusy(false);
    }
  }

  if (done) return (
    <div className="flex flex-col gap-4">
      <p role="status">{t.passwordUpdated}</p>
      <Button asChild><Link href={`/${locale}/account`}>{t.myCalendar}</Link></Button>
    </div>
  );

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="new-password">{t.newPassword}</FieldLabel>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={6} required value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="confirm-password">{t.confirmPassword}</FieldLabel>
        <Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={6} required value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} />
      </Field>
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="submit" disabled={busy} aria-busy={busy}>{t.newPassword}</Button>
    </form>
  );
}
