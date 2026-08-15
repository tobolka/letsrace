import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium tracking-tight",
    "transition-[color,background-color,border-color,transform,box-shadow,opacity] duration-150 ease-out",
    "touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "motion-reduce:transition-none motion-reduce:active:scale-100",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-stone-900 text-white hover:bg-stone-800",
        outline: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
        ghost: "text-stone-700 hover:bg-stone-100 hover:text-stone-900",
        secondary: "bg-stone-100 text-stone-900 hover:bg-stone-200",
      },
      size: {
        default: "h-9 min-h-9 px-3 [@media(pointer:coarse)]:min-h-11",
        sm: "h-8 min-h-8 px-2.5 text-xs [@media(pointer:coarse)]:min-h-10",
        lg: "h-11 min-h-11 px-4 [@media(pointer:coarse)]:min-h-12",
        icon: "h-9 w-9 min-h-9 min-w-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none sm:text-sm",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "touch-manipulation",
        "focus-visible:border-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "motion-reduce:transition-none",
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
        "flex min-h-[90px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none sm:text-sm",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "focus-visible:border-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "motion-reduce:transition-none",
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
        "inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-medium text-stone-700",
        className,
      )}
      {...props}
    />
  );
}
