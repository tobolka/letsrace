"use client";

import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui/primitives";

type Item = {
  id: string;
  url: string;
  hint_kind: string | null;
  from?: { url?: string } | null;
};

export function DiscoveryQueue({ initial }: { initial: Item[] }) {
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
      <p className="rounded-2xl bg-white p-6 text-sm text-stone-500 shadow-sm ring-1 ring-stone-200">
        Queue is empty. Run “Explore the web” or wait for the daily explorer cron.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {initial.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200"
        >
          <div className="min-w-0">
            <a href={item.url} className="break-all text-sm text-stone-900 underline" target="_blank" rel="noreferrer">
              {item.url}
            </a>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
              {item.hint_kind && <Badge>{item.hint_kind}</Badge>}
              {item.from?.url && <span>from {item.from.url}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setStatus(item.id, "accepted")}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "rejected")}>
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
