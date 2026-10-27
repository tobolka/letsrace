"use client";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { filterSnapshot, queryLengthBucket, resultBucket } from "@/lib/analytics-product";
import type { EventsQuery } from "@/lib/events-query";

/** Count the committed, visible result, never an intermediate fetch or skeleton. */
export function useResultsAnalytics({ query, count, ready, failed, scope, scopeKey = "", radius, searchPending = false, searchError = false, searchMode = "race" }: {
  query: EventsQuery; count: number; ready: boolean; failed: boolean;
  scope: "global" | "viewport" | "radius"; scopeKey?: string; radius?: number | null;
  searchPending?: boolean; searchError?: boolean; searchMode?: string;
}) {
  // Raw values exist only in memory for cancellation/dedupe; never sent.
  const queryKey = JSON.stringify({ q: query.q, series: query.series, dateFrom: query.dateFrom, dateTo: query.dateTo, categories: query.categories, disciplines: query.disciplines, levels: query.levels, country: query.country });
  const snapshot = JSON.stringify(filterSnapshot(query, radius));
  const key = JSON.stringify([queryKey, count, failed, scope, scopeKey, radius, searchError, searchMode, query.q]);
  const last = useRef<{ key: string; snapshot: string; q: string } | null>(null);
  useEffect(() => {
    if (!ready || searchPending || last.current?.key === key) return;
    const timer = setTimeout(() => {
      const previous = last.current;
      const q = (JSON.parse(queryKey) as EventsQuery).q.trim();
      const isSearch = q.length >= 2 && previous?.q !== q;
      const props = { ...JSON.parse(snapshot), geo_scope: scope, ...(!failed && !searchError ? { result_count: count, result_bucket: resultBucket(count) } : {}) };
      if (failed || searchError) track("action_failed", { action: "results", error_class: "request" });
      else track("results_view", { ...props, trigger: !previous ? "initial" : isSearch ? "search" : previous.snapshot !== snapshot ? "filter" : "viewport" });
      if (isSearch) track("search_completed", { ...props, mode: searchMode, outcome: failed || searchError ? "error" : count ? "results" : "zero", query_length_bucket: queryLengthBucket(q) });
      last.current = { key, snapshot, q };
    }, !last.current || last.current.q !== query.q.trim() ? 0 : last.current.snapshot !== snapshot ? 150 : 800);
    return () => clearTimeout(timer);
  }, [key, queryKey, snapshot, count, ready, failed, scope, searchPending, searchError, searchMode, query.q]);
}
