"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none touch-manipulation transition-[transform,color,background-color,box-shadow] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-muted-foreground data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:text-primary-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:text-primary-foreground",
      },
      size: {
        default: "h-9 min-w-9 px-2 [@media(pointer:coarse)]:h-11",
        xs: "h-7 min-w-7 px-1.5 text-xs [@media(pointer:coarse)]:h-11",
        sm: "h-8 min-w-8 px-1.5 [@media(pointer:coarse)]:h-11",
        lg: "h-10 min-w-10 px-2.5 [@media(pointer:coarse)]:h-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
