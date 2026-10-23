"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Messages } from "@/lib/i18n/messages";

/** The search icon at the end of the bar; once there is a query it becomes a chip with a clear button. */
export function PlaceSearch({
  q,
  messages,
  onQ,
  onSubmit,
}: {
  q: string;
  messages: Messages;
  onQ: (q: string) => void;
  onSubmit: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const form = (
    <PopoverContent align="end" className="w-72 p-2" collisionPadding={12}>
      <PlaceSearchForm
        q={q}
        messages={messages}
        onQ={onQ}
        onSubmit={() => {
          onSubmit();
          setSearchOpen(false);
        }}
      />
    </PopoverContent>
  );

  if (q.trim()) {
    return (
      <div className="inline-flex h-full max-w-[min(100%,12rem)] shrink-0 items-center">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={messages.search}
              className="rounded-r-none"
            >
              <Search />
              <span className="max-w-[8rem] truncate">{q.trim()}</span>
            </Button>
          </PopoverTrigger>
          {form}
        </Popover>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label={messages.clearFilter}
          className="rounded-l-none"
          onClick={() => onQ("")}
        >
          <X />
        </Button>
      </div>
    );
  }
  return (
    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={messages.search}
          className="size-8 [@media(pointer:coarse)]:size-11"
        >
          <Search />
        </Button>
      </PopoverTrigger>
      {form}
    </Popover>
  );
}

function PlaceSearchForm({
  q,
  messages,
  onQ,
  onSubmit,
}: {
  q: string;
  messages: Messages;
  onQ: (q: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          name="q"
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={messages.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={messages.search}
          autoFocus
        />
      </InputGroup>
    </form>
  );
}
