/** A bounded list: arrows stop at the ends rather than unexpectedly wrapping. */
export function keyboardListIndex(key: string, current: number, length: number): number | null {
  if (!length) return null;
  switch (key) {
    case "ArrowDown": return Math.min(length - 1, current + 1);
    case "ArrowUp": return Math.max(0, current - 1);
    case "Home": return 0;
    case "End": return length - 1;
    default: return null;
  }
}

export function visibleKeyboardItems(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-keyboard-item]"))
    .filter((el) => el.getClientRects().length > 0 && !el.closest("[inert], [aria-hidden=true]") && !el.matches(":disabled"));
}

export function focusKeyboardItem(item: HTMLElement) {
  item.focus({ preventScroll: true });
  item.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}
