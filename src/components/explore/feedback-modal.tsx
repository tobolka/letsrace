"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Feature / feedback</DialogTitle>
          <DialogDescription>
            Tell us what to build next, what&apos;s broken, or what feels off.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <Button
                  key={k.id}
                  type="button"
                  size="sm"
                  variant={kind === k.id ? "default" : "outline"}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="I’d like filters by distance from home…"
              className="min-h-[120px]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-email">Email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
            />
          </div>
          {status ? <p className="text-sm">{status}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={busy || message.trim().length < 3} aria-busy={busy}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
