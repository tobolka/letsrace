"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n/messages";

export function MobileSearchSheet({
  open,
  onOpenChange,
  messages,
  q,
  onQ,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Messages;
  q: string;
  onQ: (q: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <DrawerContent className="md:hidden">
        <DrawerHandle />
        <DrawerTitle className="px-4 pb-2 text-left text-base font-semibold">
          {messages.search}
        </DrawerTitle>
        <form
          className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
            onOpenChange(false);
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              name="q"
              type="search"
              value={q}
              onChange={(e) => onQ(e.target.value)}
              placeholder={messages.searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-label={messages.search}
              className="h-12 rounded-xl border bg-background pr-11 pl-10 text-base shadow-none"
            />
            {q.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 size-10 -translate-y-1/2 rounded-full"
                aria-label={messages.clearFilter}
                onClick={() => onQ("")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <Button type="submit" size="lg" className="h-12 w-full text-base">
            {messages.search}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
