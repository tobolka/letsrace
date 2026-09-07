"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OpenUrlButton } from "@/components/admin/open-url";
import { firstOpenableUrl } from "@/lib/admin/urls";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type Submission = {
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

type Kind = "feedback" | "submission" | "notification";

type Entry = {
  id: string;
  kind: Kind;
  open: boolean;
  createdAt: string;
  /** Sorting key, so the oldest unanswered thing is the one you meet first. */
  time: number;
};

const KIND_LABEL: Record<Kind, string> = {
  feedback: "Feedback",
  submission: "Race sent in",
  notification: "Watcher",
};

function ago(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * One queue, not three.
 *
 * The inbox held three cards side by side — feedback, submitted races, watcher
 * notifications — each with its own list, its own empty state, and everything
 * mixed together whether it had been dealt with or not. Three lists that never
 * empty are not an inbox; they are three places to feel guilty about.
 *
 * It is one stream now, open first and oldest first, because the oldest
 * unanswered message is the one that matters. What has been dealt with is one
 * click away and out of the way.
 */
export function SubmissionsInbox({
  notifications,
  submissions,
  feedback,
}: {
  notifications: Notification[];
  submissions: Submission[];
  feedback: Feedback[];
}) {
  const [notes, setNotes] = useState(notifications);
  const [subs, setSubs] = useState(submissions);
  const [items, setItems] = useState(feedback);
  const [view, setView] = useState<"open" | "done">("open");

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function setFeedbackStatus(id: string, status: string) {
    await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  }

  async function markRead(id: string) {
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }

  const entries: Entry[] = useMemo(() => {
    const all: Entry[] = [
      ...items.map((f) => ({
        id: f.id,
        kind: "feedback" as const,
        open: f.status === "pending",
        createdAt: f.created_at,
        time: Date.parse(f.created_at),
      })),
      ...subs.map((s) => ({
        id: s.id,
        kind: "submission" as const,
        open: s.status === "pending",
        createdAt: s.created_at,
        time: Date.parse(s.created_at),
      })),
      ...notes.map((n) => ({
        id: n.id,
        kind: "notification" as const,
        open: !n.read_at,
        createdAt: n.created_at,
        time: Date.parse(n.created_at),
      })),
    ];
    // Oldest first while open — a message from three weeks ago is the one that
    // has been waiting. Newest first once it is history.
    return all
      .filter((e) => (view === "open" ? e.open : !e.open))
      .sort((a, b) => (view === "open" ? a.time - b.time : b.time - a.time));
  }, [items, subs, notes, view]);

  const openCount =
    items.filter((f) => f.status === "pending").length +
    subs.filter((s) => s.status === "pending").length +
    notes.filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => setView((v || "open") as "open" | "done")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="open">Waiting {openCount}</ToggleGroupItem>
          <ToggleGroupItem value="done">Dealt with</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {entries.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>
              {view === "open" ? "Nothing is waiting" : "Nothing dealt with yet"}
            </EmptyTitle>
            <EmptyDescription>
              {view === "open"
                ? "Every message, submitted race and watcher alert has been answered."
                : "Answered items collect here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-2">
          {entries.map((entry) => {
            if (entry.kind === "feedback") {
              const f = items.find((x) => x.id === entry.id)!;
              return (
                <Row key={`f-${f.id}`} kind="feedback" when={f.created_at} open={entry.open}>
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{f.kind}</Badge>
                  </ItemTitle>
                  <ItemDescription className="whitespace-pre-wrap text-foreground">
                    {f.message}
                  </ItemDescription>
                  {f.email ? (
                    <a href={`mailto:${f.email}`} className="text-xs underline underline-offset-4">
                      {f.email}
                    </a>
                  ) : null}
                  {entry.open ? (
                    <ItemActions>
                      <Button size="sm" onClick={() => void setFeedbackStatus(f.id, "done")}>
                        Done
                      </Button>
                    </ItemActions>
                  ) : null}
                </Row>
              );
            }

            if (entry.kind === "submission") {
              const s = subs.find((x) => x.id === entry.id)!;
              return (
                <Row key={`s-${s.id}`} kind="submission" when={s.created_at} open={entry.open}>
                  <ItemTitle className="flex items-start gap-1">
                    <span className="min-w-0 break-all">{s.url}</span>
                    <OpenUrlButton href={firstOpenableUrl(s.url)} label="Open submitted URL" />
                  </ItemTitle>
                  {s.note ? <ItemDescription>{s.note}</ItemDescription> : null}
                  {entry.open ? (
                    <ItemActions>
                      <ButtonGroup>
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
                      </ButtonGroup>
                    </ItemActions>
                  ) : (
                    <ItemActions>
                      <Badge variant="outline">{s.status}</Badge>
                    </ItemActions>
                  )}
                </Row>
              );
            }

            const n = notes.find((x) => x.id === entry.id)!;
            return (
              <Row key={`n-${n.id}`} kind="notification" when={n.created_at} open={entry.open}>
                <ItemTitle>{n.title}</ItemTitle>
                <ItemDescription className="whitespace-pre-wrap">{n.body}</ItemDescription>
                {entry.open ? (
                  <ItemActions>
                    <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                      Mark read
                    </Button>
                  </ItemActions>
                ) : null}
              </Row>
            );
          })}
        </ItemGroup>
      )}
    </div>
  );
}

function Row({
  kind,
  when,
  open,
  children,
}: {
  kind: Kind;
  when: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <Item variant={open ? "outline" : "muted"} className="items-start">
      <ItemContent className="min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{KIND_LABEL[kind]}</span>
          <span aria-hidden>·</span>
          <time dateTime={when} className="tabular-nums">
            {ago(when)}
          </time>
        </div>
        {children}
      </ItemContent>
    </Item>
  );
}
