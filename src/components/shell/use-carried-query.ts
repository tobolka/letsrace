"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { carryFilterQuery } from "@/lib/explore-params";

/**
 * A click handler that takes the filters along to another view.
 *
 * The query is read from the address bar at the moment of the click rather
 * than rendered into the link: rendering it needs `useSearchParams`, which puts
 * the whole sidebar behind a Suspense boundary, and a boundary that hydrates
 * late let shadcn's sidebar decide it was on a phone before it had hydrated —
 * a different tree from the server's. A plain modified click (new tab) still
 * gets the bare view, which is a fine place to land.
 */
export function useCarryFilters() {
  const router = useRouter();
  return (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const carry = carryFilterQuery(new URLSearchParams(window.location.search));
    if (!carry) return;
    e.preventDefault();
    router.push(`${href}${carry}`);
  };
}
