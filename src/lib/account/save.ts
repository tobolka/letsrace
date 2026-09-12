import { toast } from "sonner";
import { messagesFor } from "@/lib/i18n/messages";

/**
 * A write the user has already been shown as done.
 *
 * The account writes its changes optimistically — a note appears on the day the
 * moment it is typed, a rider's preferences the moment they are picked — and
 * then ignored what the database said. A rejected write left the plan looking
 * saved until the next reload, and `alert-settings` went further and toasted
 * "Saved" whichever way the write went. A plan the user cannot trust to hold is
 * worse than one that admits it lost something.
 *
 * `onFailure` puts the optimistic change back the way it was.
 */
export async function persist(
  work: PromiseLike<{ error: { message: string } | null }>,
  opts: { locale: string; onFailure?: () => void },
): Promise<boolean> {
  try {
    const { error } = await work;
    if (!error) return true;
  } catch {
    // Network failures reject rather than returning a database error.
  }
  opts.onFailure?.();
  toast.error(messagesFor(opts.locale).saveFailed);
  return false;
}
