import { cn } from "@/lib/utils"

// A tint of the ink rather than `bg-accent`: accent is the page's own stone,
// so on the account pages — which load straight onto that ground — every
// placeholder was invisible and the page looked blank until the data arrived.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-foreground/[0.07] motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
