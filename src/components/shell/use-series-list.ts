"use client";

import { useEffect, useState } from "react";
import type { SeriesOption } from "@/lib/explore-filters";
import { loadSeriesList } from "@/lib/series-list";

/**
 * Every cup on offer, for the pickers.
 *
 * The cup and country pickers list what exists, not what survives the other
 * filters — "kids" on a single weekend left them empty and the menu bare. The
 * answer is fetched once per page load and shared by every view.
 */
export function useSeriesList(): SeriesOption[] {
  const [list, setList] = useState<SeriesOption[]>([]);
  useEffect(() => {
    let alive = true;
    void loadSeriesList("")
      .then((data) => {
        if (alive) setList(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
