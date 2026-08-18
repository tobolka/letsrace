"use client";

import { track } from "@vercel/analytics";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  eventName: string;
  eventProps?: Record<string, string | number | boolean | null>;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
};

export function OutboundTrackLink({
  href,
  className,
  children,
  eventName,
  eventProps,
  variant = "outline",
  size = "lg",
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={() => {
        track(eventName, eventProps);
      }}
    >
      {children}
    </a>
  );
}
