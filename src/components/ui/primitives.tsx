import type { ComponentProps } from "react";
import { Badge as UiBadge } from "@/components/ui/badge";

export { Button, buttonVariants } from "@/components/ui/button";
export { Input } from "@/components/ui/input";
export { Textarea } from "@/components/ui/textarea";
export { Label } from "@/components/ui/label";
export { badgeVariants } from "@/components/ui/badge";

/** Existing call sites treated Badge as a muted chip; keep that as the default. */
export function Badge({
  variant = "secondary",
  ...props
}: ComponentProps<typeof UiBadge>) {
  return <UiBadge variant={variant} {...props} />;
}
