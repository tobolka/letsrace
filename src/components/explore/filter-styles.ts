/** A filter that is on, and the cross that clears it: a step darker than a chip that is off. */
export const ACTIVE_CHIP =
  "bg-foreground/[0.09] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground/[0.13]";

/** Menu rows are 44 px tall on touch screens. */
export const itemClass = "max-md:min-h-11 [@media(pointer:coarse)]:min-h-11";
