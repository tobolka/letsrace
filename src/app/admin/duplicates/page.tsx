import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { listSuspiciousDuplicates, dismissSuspiciousPair } from "@/lib/catalog/suspicious-duplicates";
import { mergeEventPair } from "@/lib/catalog/merge-duplicates";
import { DuplicateReview } from "@/components/admin/duplicate-review";

export default async function DuplicatesPage() {
  await requireAdminPage();
  const pairs = await listSuspiciousDuplicates();

  async function merge(keepId: string, dropId: string) {
    "use server";
    await requireAdminPage();
    await mergeEventPair(keepId, dropId);
    revalidatePath("/admin/duplicates");
  }

  async function dismiss(leftId: string, rightId: string) {
    "use server";
    await requireAdminPage();
    await dismissSuspiciousPair(leftId, rightId);
    revalidatePath("/admin/duplicates");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Races sharing a venue, a day and a discipline that the merger would not take on its
          own. Roughly half of these are two real races — a town holds more than one bike race on
          a Sunday — so each one is a question, not a verdict.
        </p>
      </div>
      <DuplicateReview pairs={pairs} onMerge={merge} onDismiss={dismiss} />
    </div>
  );
}
