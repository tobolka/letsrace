"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Inline text with the same tooltip as a chip. Used inside a row button, so it stays a span. */
export function ExplainedHint({
  explanation,
  className,
  children,
}: {
  explanation: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-help", className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-left leading-snug">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}

/** A chip that explains itself. The native title never showed up on the map card. */
export function ExplainedBadge({
  explanation,
  className,
  children,
}: {
  explanation?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!explanation) {
    return (
      <Badge variant="outline" className={className}>
        {children}
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn("cursor-help", className)}>
          {children}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-left leading-snug">
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}
