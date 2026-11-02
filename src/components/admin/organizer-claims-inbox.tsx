"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";

export type PendingClaim = {
  id: string;
  email: string;
  note: string | null;
  createdAt: string;
  kind: "race" | "series";
  name: string;
  slug: string;
  website: string | null;
};

/**
 * Organisers waiting for a yes. Only claims the email could not prove land
 * here; an address on the race website's domain was verified already.
 */
export function OrganizerClaimsInbox({ claims }: { claims: PendingClaim[] }) {
  const [open, setOpen] = useState(claims);
  if (!open.length) return null;

  async function decide(id: string, status: "verified" | "rejected") {
    const res = await fetch("/api/admin/organizer-claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      toast.error("Could not save the decision");
      return;
    }
    setOpen((list) => list.filter((c) => c.id !== id));
    toast.success(status === "verified" ? "Organiser verified" : "Claim rejected");
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Organisers waiting ({open.length})</h2>
      <ItemGroup className="rounded-xl border">
        {open.map((c) => (
          <Item key={c.id} className="border-b last:border-b-0">
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full min-w-0">
                <a href={`/cs/${c.kind === "race" ? "zavod" : "serie"}/${c.slug}`} target="_blank" rel="noreferrer" className="truncate hover:underline">
                  {c.kind === "series" ? "Series · " : ""}
                  {c.name}
                </a>
              </ItemTitle>
              <ItemDescription className="break-words">
                {c.email}
                {c.website ? ` · web ${c.website}` : " · no website on file"}
                {c.note ? ` — ${c.note}` : ""}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ButtonGroup>
                <Button size="sm" onClick={() => void decide(c.id, "verified")}>
                  Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => void decide(c.id, "rejected")}>
                  Reject
                </Button>
              </ButtonGroup>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
