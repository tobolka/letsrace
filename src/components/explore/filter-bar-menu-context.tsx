"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type FilterBarMenuContextValue = {
  openId: string | null;
  setOpenFor: (id: string, next: boolean) => void;
};

const FilterBarMenuContext = createContext<FilterBarMenuContextValue | null>(null);

/**
 * Coordinates all popovers/dropdowns in the filter bar so at most one filter
 * menu can be open at a time — opening another immediately closes the previous.
 */
export function FilterBarMenuProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const setOpenFor = useCallback((id: string, next: boolean) => {
    if (next) setOpenId(id);
    else setOpenId((current) => (current === id ? null : current));
  }, []);

  return (
    <FilterBarMenuContext.Provider value={{ openId, setOpenFor }}>
      {children}
    </FilterBarMenuContext.Provider>
  );
}

export function useFilterMenu(id: string): { open: boolean; onOpenChange: (next: boolean) => void } {
  const ctx = useContext(FilterBarMenuContext);
  const [localOpen, setLocalOpen] = useState(false);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (ctx) ctx.setOpenFor(id, next);
      else setLocalOpen(next);
    },
    [ctx, id],
  );

  return {
    open: ctx ? ctx.openId === id : localOpen,
    onOpenChange,
  };
}
