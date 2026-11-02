"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

export type PendingProposal = {
  id: string;
  title: string;
  email: string | null;
  createdAt: string;
  action: "edit" | "create";
  slug: string | null;
  /** Field → [current, proposed]; for a new race, current is empty. */
  rows: { field: string; before: string; after: string }[];
};

/**
 * Readers' proposals: an edit to a race, or a new race. Each shows what would
 * change, from what to what, so the decision is made here, not on the race.
 */
export function ProposalsInbox({ proposals }: { proposals: PendingProposal[] }) {
  const [open, setOpen] = useState(proposals);
  if (!open.length) return null;

  async function decide(id: string, decision: "approve" | "reject") {
    const res = await fetch("/api/admin/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    if (!res.ok) {
      toast.error("Could not save the decision");
      return;
    }
    setOpen((list) => list.filter((p) => p.id !== id));
    toast.success(decision === "approve" ? "Applied" : "Rejected");
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Proposed changes ({open.length})</h2>
      <ul className="flex flex-col gap-3">
        {open.map((p) => (
          <li key={p.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {p.slug ? (
                    <a href={`/cs/zavod/${p.slug}`} target="_blank" rel="noreferrer" className="hover:underline">
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.email ?? "—"} · {new Date(p.createdAt).toLocaleString()}
                </p>
              </div>
              <ButtonGroup>
                <Button size="sm" onClick={() => void decide(p.id, "approve")}>
                  {p.action === "create" ? "Create race" : "Apply"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void decide(p.id, "reject")}>
                  Reject
                </Button>
              </ButtonGroup>
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {p.rows.map((r) => (
                  <tr key={r.field} className="border-t align-top">
                    <th scope="row" className="w-40 py-1.5 pr-3 text-left font-normal text-muted-foreground">{r.field}</th>
                    {p.action === "edit" ? <td className="py-1.5 pr-3 text-muted-foreground line-through decoration-muted-foreground/50 break-words">{r.before || "—"}</td> : null}
                    <td className="py-1.5 break-words">{r.after || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </section>
  );
}
