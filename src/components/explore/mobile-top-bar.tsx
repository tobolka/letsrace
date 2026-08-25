"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n/messages";

export function MobileTopBar({
  messages,
  q,
  onQ,
  onSearchSubmit,
  menu,
  filters,
}: {
  messages: Messages;
  q: string;
  onQ: (q: string) => void;
  onSearchSubmit: () => void;
  menu: ReactNode;
  filters: ReactNode;
}) {
  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2">
      <form
        className="flex items-center gap-0.5 rounded-[1.75rem] bg-card py-0.5 pr-3 pl-0.5 shadow-md ring-1 ring-black/8"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        {menu}
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          name="q"
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={messages.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={messages.search}
          className="h-11 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </form>
      <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card/95 p-1 shadow-sm ring-1 ring-black/8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters}
      </div>
    </div>
  );
}
