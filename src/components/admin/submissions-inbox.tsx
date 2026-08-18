"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Feature / feedback</CardTitle>
          <CardDescription>Requests from the map.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyTitle>No feedback yet</EmptyTitle>
                <EmptyDescription>New messages will show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {items.map((f) => (
                <Item key={f.id} variant="outline">
                  <ItemContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{f.kind}</Badge>
                      <Badge variant="outline">{f.status}</Badge>
                    </div>
                    <ItemDescription className="whitespace-pre-wrap">{f.message}</ItemDescription>
                    {f.email ? (
                      <a href={`mailto:${f.email}`} className="text-xs underline">
                        {f.email}
                      </a>
                    ) : null}
                    <ItemDescription className="tabular-nums">
                      {new Date(f.created_at).toLocaleString()}
                    </ItemDescription>
                    {f.status === "pending" ? (
                      <ButtonGroup>
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
                      </ButtonGroup>
                    ) : null}
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Race submissions</CardTitle>
          <CardDescription>URLs sent in as missing races.</CardDescription>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyTitle>No submissions yet</EmptyTitle>
                <EmptyDescription>Missing-race reports land here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {subs.map((s) => (
                <Item key={s.id} variant="outline">
                  <ItemContent>
                    <ItemTitle>
                      <a href={s.url} target="_blank" rel="noreferrer" className="break-all">
                        {s.url}
                      </a>
                    </ItemTitle>
                    {s.note ? <ItemDescription>{s.note}</ItemDescription> : null}
                    <ItemDescription className="tabular-nums">
                      {new Date(s.created_at).toLocaleString()}
                    </ItemDescription>
                    {s.status === "pending" ? (
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
                    ) : null}
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="outline">{s.status}</Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Watcher and ingest alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyTitle>Inbox empty</EmptyTitle>
                <EmptyDescription>No notifications right now.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="grid gap-2 lg:grid-cols-2">
              {notes.map((n) => (
                <Item key={n.id} variant={n.read_at ? "muted" : "outline"}>
                  <ItemContent>
                    <ItemTitle>{n.title}</ItemTitle>
                    <ItemDescription className="whitespace-pre-wrap">{n.body}</ItemDescription>
                    <ItemDescription className="tabular-nums">
                      {new Date(n.created_at).toLocaleString()} · {n.kind}
                    </ItemDescription>
                  </ItemContent>
                  {!n.read_at ? (
                    <ItemActions>
                      <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                        Mark read
                      </Button>
                    </ItemActions>
                  ) : null}
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
