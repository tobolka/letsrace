"use client";

import { useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Kind = "feature" | "feedback" | "bug";

export function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("feature");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        message,
        email: email || null,
        userId: auth.user?.id ?? null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Could not send — try again");
      return;
    }
    setStatus("Thanks — we got it.");
    setMessage("");
    setEmail("");
  }

  const kinds: { id: Kind; label: string }[] = [
    { id: "feature", label: "Feature" },
    { id: "feedback", label: "Feedback" },
    { id: "bug", label: "Bug" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-xl font-semibold tracking-tight">Feature / feedback</h2>
        <p className="mt-1 text-sm text-stone-500">
          Tell us what to build next, what&apos;s broken, or what feels off.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide ring-1 ${
                    kind === k.id
                      ? "bg-stone-900 text-white ring-stone-900"
                      : "bg-white text-stone-600 ring-stone-200"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="I’d like filters by distance from home…"
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-1">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
            />
          </div>
          {status ? <p className="text-sm text-stone-900">{status}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={busy || message.trim().length < 3}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
