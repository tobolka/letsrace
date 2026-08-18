"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { firstOpenableUrl, OpenUrlButton } from "@/components/admin/open-url";

type ItemRow = {
  id: string;
  url: string;
  hint_kind: string | null;
  from?: { url?: string } | null;
};

export function DiscoveryQueue({ initial }: { initial: ItemRow[] }) {
  const router = useRouter();

  async function setStatus(id: string, status: "accepted" | "rejected") {
    await fetch("/api/admin/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  if (!initial.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Queue is empty</EmptyTitle>
          <EmptyDescription>
            Run “Explore the web” or wait for the daily explorer cron.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup className="gap-2">
      {initial.map((item) => (
        <Item key={item.id} variant="outline">
          <ItemContent>
            <ItemTitle className="flex items-start gap-1">
              <span className="min-w-0 break-all">{item.url}</span>
              <OpenUrlButton href={firstOpenableUrl(item.url)} label="Open discovered URL" />
            </ItemTitle>
            <ItemDescription>
              {item.hint_kind ? <Badge variant="secondary">{item.hint_kind}</Badge> : null}
              {item.from?.url ? <span> from {item.from.url}</span> : null}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <ButtonGroup>
              <Button size="sm" onClick={() => setStatus(item.id, "accepted")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "rejected")}>
                Reject
              </Button>
            </ButtonGroup>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
