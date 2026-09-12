import { PlanHome } from "@/components/account/plan-home";
import { isMatch } from "date-fns";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const day = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) && isMatch(query.day, "yyyy-MM-dd") ? query.day : undefined;
  return <PlanHome key={day ?? "all"} locale={locale} section="recommendations" day={day} />;
}
