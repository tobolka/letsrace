"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * One choice out of a few, side by side: the sort order, sign in or sign up,
 * how the plan is shown. It wears the tabs' look — a grey track with the
 * chosen one lifted out in white — so a switch reads the same wherever it is,
 * whether it swaps a panel (tabs) or the order of a list (this).
 *
 * Several choices at once (weekdays, disciplines) stay chips; this is for one.
 */
const SIZES = {
  xs: "h-7 text-xs [@media(pointer:coarse)]:h-11",
  sm: "h-8 text-sm [@media(pointer:coarse)]:h-11",
  default: "h-9 text-sm [@media(pointer:coarse)]:h-11",
} as const

function Segmented({
  className,
  value,
  onValueChange,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, "type" | "value" | "defaultValue" | "onValueChange"> & {
  value: string
  /** Called with the new choice only: pressing the chosen one again keeps it. */
  onValueChange: (value: string) => void
  size?: keyof typeof SIZES
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      data-slot="segmented"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next)
      }}
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground",
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  )
}

function SegmentedItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-item"
      className={cn(
        "inline-flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 font-medium whitespace-nowrap text-foreground/60 outline-none touch-manipulation",
        "transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:border-input dark:data-[state=on]:bg-input/30",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
