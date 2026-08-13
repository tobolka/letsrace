"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui/primitives";

type Note = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type Sub = {
  id: string;
  url: string;
  note: string | null;
  status: string;
  created_at: string;
};

type Feedback = {
  id: string;
  kind: string;
  message: string;
  email: string | null;
  status: string;
  created_at: string;
};

export function SubmissionsInbox({
  notifications,
  submissions,
  feedback,
}: {
  notifications: Note[];
  submissions: Sub[];
  feedback: Feedback[];
}) {
  const [subs, setSubs] = useState(submissions);
  const [notes, setNotes] = useState(notifications);
  const [items, setItems] = useState(feedback);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function setFeedbackStatus(id: string, status: string) {
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  }

  async function markRead(id: string) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Feature / feedback
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">No feedback yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((f) => (
              <li key={f.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="font-mono uppercase">{f.kind}</Badge>
                      <Badge>{f.status}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{f.message}</p>
                    {f.email ? (
                      <a
                        href={`mailto:${f.email}`}
                        className="mt-1 inline-block text-xs text-stone-500 underline"
                      >
                        {f.email}
                      </a>
                    ) : null}
                    <p className="mt-1 font-mono text-[11px] text-stone-400">
                      {new Date(f.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {f.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void setFeedbackStatus(f.id, "done")}>
                      Done
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setFeedbackStatus(f.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Race submissions
        </h2>
        {subs.length === 0 ? (
          <p className="text-sm text-stone-500">No submissions yet.</p>
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm font-medium text-stone-900 underline"
                    >
                      {s.url}
                    </a>
                    {s.note && <p className="mt-1 text-xs text-stone-500">{s.note}</p>}
                    <p className="mt-1 font-mono text-[11px] text-stone-400">
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge>{s.status}</Badge>
                </div>
                {s.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void setStatus(s.id, "approved")}>
                      Approve + watch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void setStatus(s.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 lg:col-span-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Notifications
        </h2>
        {notes.length === 0 ? (
          <p className="text-sm text-stone-500">Inbox empty.</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl p-4 shadow-sm ring-1 ring-stone-200 ${
                  n.read_at ? "bg-stone-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-stone-900">{n.title}</p>
                    <p className="mt-0.5 break-all whitespace-pre-wrap text-sm text-stone-600">
                      {n.body}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-stone-400">
                      {new Date(n.created_at).toLocaleString()} · {n.kind}
                    </p>
                  </div>
                  {!n.read_at && (
                    <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
