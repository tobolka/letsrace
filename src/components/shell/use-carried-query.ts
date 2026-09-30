"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { carryFilterQuery } from "@/lib/explore-params";

const noop = () => () => {};

/**
 * The filters as a query string for a link to another view.
 *
 * The layout is prerendered without a query, so the server's links carry none.
 * Reading the URL on the first client render would put different hrefs on the
 * same elements and fail hydration; the query is added on the render after.
 */
export function useCarriedQuery(): string {
  const search = useSearchParams();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return hydrated ? carryFilterQuery(search) : "";
}
