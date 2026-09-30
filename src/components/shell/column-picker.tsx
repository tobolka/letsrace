"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Columns3, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { LOCKED, moveColumn, type ColumnLayout, type ListColumn } from "@/lib/list-columns";
import { cn } from "@/lib/utils";

/**
 * Pick the list's columns, drag them into order, or put the default back.
 *
 * Dragging is the quick way; the arrows beside each row are the same move for
 * a keyboard, and for anybody who finds dragging inside a popover fiddly.
 */
export function ColumnPicker({
  layout,
  labels,
  title,
  resetLabel,
  isDefault,
  onChange,
  onReset,
}: {
  layout: ColumnLayout;
  labels: Record<ListColumn, string>;
  title: string;
  resetLabel: string;
  isDefault: boolean;
  onChange: (next: ColumnLayout) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState<ListColumn | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const shown = layout.order.filter((c) => !layout.hidden.includes(c)).length;

  function toggle(col: ListColumn, on: boolean) {
    onChange({
      ...layout,
      hidden: on ? layout.hidden.filter((c) => c !== col) : [...layout.hidden, col],
    });
  }

  function move(col: ListColumn, to: number) {
    onChange({ ...layout, order: moveColumn(layout.order, col, to) });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Columns3 data-icon="inline-start" />
          {title}
          <span className="text-muted-foreground tabular-nums">{shown}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <ul className="flex flex-col" onDragLeave={() => setOver(null)}>
          {layout.order.map((col, i) => {
            const locked = LOCKED.includes(col);
            const on = !layout.hidden.includes(col);
            return (
              <li
                key={col}
                draggable
                onDragStart={(e) => {
                  setDragging(col);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) move(dragging, i);
                  setDragging(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent",
                  dragging === col && "opacity-40",
                  over === i && dragging && dragging !== col && "bg-accent",
                )}
              >
                <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <Checkbox
                    checked={on}
                    disabled={locked}
                    onCheckedChange={(v) => toggle(col, v === true)}
                  />
                  <span className={cn("truncate", !on && "text-muted-foreground")}>{labels[col]}</span>
                </label>
                <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${labels[col]} ↑`}
                    disabled={i === 0}
                    onClick={() => move(col, i - 1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${labels[col]} ↓`}
                    disabled={i === layout.order.length - 1}
                    onClick={() => move(col, i + 1)}
                  >
                    <ChevronDown />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
        <Separator className="my-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          disabled={isDefault}
          onClick={onReset}
        >
          <RotateCcw data-icon="inline-start" />
          {resetLabel}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
