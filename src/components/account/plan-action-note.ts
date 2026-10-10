import { messagesFor } from "@/lib/i18n/messages";
import type { PlanAction, PlanActionKind } from "@/lib/plan-actions";

/**
 * What a race in the plan is waiting for, in a few words — "decide who is
 * going", "enter" — shown on the race's own row, so the
 * list you work through tells you what to do instead of a second list beside
 * it repeating the same races.
 */
export function planActionNote(action: PlanAction, locale: string): string {
  const t = messagesFor(locale);
  const label: Record<PlanActionKind, string> = {
    who: t.planActionWho,
    enter: t.planActionEnter,
    pay: t.planActionPay,
  };
  return label[action.kind];
}
