import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-50",
        variant === "default" && "bg-stone-900 text-white hover:bg-stone-800",
        variant === "outline" && "border border-stone-300 bg-white hover:bg-stone-50",
        variant === "ghost" && "hover:bg-stone-100",
        variant === "secondary" && "bg-stone-100 text-stone-900 hover:bg-stone-200",
        size === "default" && "h-9 px-3",
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "lg" && "h-10 px-4",
        size === "icon" && "h-9 w-9",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/15",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/15",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-medium text-stone-700", className)} {...props} />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-medium text-stone-700",
        className,
      )}
      {...props}
    />
  );
}
