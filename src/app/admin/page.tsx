import Link from "next/link";
import { z } from "zod";
import { CircleCheck } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { formatPrague, getOwnerTasks } from "@/lib/admin/owner-tasks";
import { createServerSupabase } from "@/lib/supabase/server";
import { discoveryUrl } from "@/lib/discovery/plan";
import { OwnerRefresh, OwnerRefreshButton } from "@/components/admin/owner-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const optionsSchema = z.array(z.object({ value: z.string().min(1).max(100), label: z.string().min(1).max(160) })).min(2).max(4);
const evidenceSchema = z.object({ sources: z.array(z.object({ url: z.string().max(2000), quote: z.string().max(800).optional() })).max(5).optional() });

/**
 * The admin is the owner's to-do list and nothing more.
 *
 * Website suggestions, sources that cannot be read yet and possible duplicates
 * are the Mac's and the agent's work; they are not shown, because a long queue
 * nobody has to clear only reads as an alarm. What remains is what a machine
 * cannot do, each with the one thing to do about it. The same list goes out by
 * e-mail, so an empty page is the normal state.
 */
export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ decision?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;

  let loaded: Awaited<ReturnType<typeof getOwnerTasks>>;
  try {
    loaded = await getOwnerTasks();
  } catch {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <OwnerRefresh />
        <h1 className="text-2xl font-semibold">Přehled se nepodařilo načíst</h1>
        <p className="text-muted-foreground">Zkus to za chvíli znovu. Když to nepůjde ani potom, napiš Claude Code: „Admin LetsRace se nenačítá.“</p>
        <OwnerRefreshButton />
      </section>
    );
  }
  const { input, tasks } = loaded;

  const questions = input.questions > 0
    ? await createServerSupabase()
        .from("pipeline_owner_decisions")
        .select("key,question,reason,recommendation,default_action,options,evidence,updated_at")
        .eq("status", "open")
        .order("created_at")
        .limit(20)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <OwnerRefresh />
      {params.decision && (
        <p role="status" className="rounded-lg border p-4 text-sm">
          {params.decision === "saved"
            ? "Odpověď je uložená. Systém ji provede sám."
            : params.decision === "changed"
              ? "Otázka se mezitím změnila nebo už má odpověď. Podívej se na ni znovu."
              : "Odpověď se nepodařilo uložit. Vyber jednu z nabídnutých možností."}
        </p>
      )}

      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {tasks.length === 0 ? "Nic po tobě nepotřebuju" : tasks.length === 1 ? "Potřebuju tě na jednu věc" : `Potřebuju tě na ${tasks.length} ${tasks.length < 5 ? "věci" : "věcí"}`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {tasks.length === 0
            ? "Weby pořadatelů čte Mac, nové weby a sporné případy posuzuje agent. Když bude potřeba tebe, přijde ti e-mail."
            : "Každá věc má jeden krok. Nic dalšího hlídat ani schvalovat nemusíš."}
        </p>
      </header>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <CircleCheck className="size-6 shrink-0 text-emerald-600" aria-hidden />
            <p>Všechno běží samo.</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {tasks.map((task) => (
            <li key={task.key}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{task.what}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="rounded-md bg-muted p-3 leading-relaxed">
                    <strong>Co udělat:</strong> {task.todo}
                  </p>
                  {task.link && (
                    <Button asChild className="self-start">
                      <Link href={task.link.href}>{task.link.label}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {questions?.data?.length ? (
        <section id="otazky" aria-labelledby="questions-heading" className="flex flex-col gap-4">
          <h2 id="questions-heading" className="text-lg font-semibold">Otázky</h2>
          {questions.data.map((question) => {
            const options = optionsSchema.safeParse(question.options);
            const evidence = evidenceSchema.safeParse(question.evidence);
            return (
              <Card key={question.key}>
                <CardHeader>
                  <CardTitle className="text-lg">{question.question}</CardTitle>
                  <CardDescription className="leading-relaxed">{question.reason}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <p><strong>Doporučuju:</strong> {question.recommendation}</p>
                  <p><strong>Když neodpovíš:</strong> {question.default_action}</p>
                  {evidence.success &&
                    evidence.data.sources?.map((source) => {
                      const url = discoveryUrl(source.url);
                      return url ? (
                        <div key={url} className="flex flex-col gap-1">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">
                            Podklad: {new URL(url).hostname}
                          </a>
                          {source.quote && <p className="text-muted-foreground">„{source.quote}“</p>}
                        </div>
                      ) : null;
                    })}
                  {options.success ? (
                    <form action="/api/admin/owner-decision" method="post" className="flex flex-wrap gap-3">
                      <input type="hidden" name="key" value={question.key} />
                      <input type="hidden" name="updatedAt" value={question.updated_at} />
                      {options.data.map((option) => (
                        <Button key={option.value} name="answer" value={option.value} type="submit" variant="outline">
                          {option.label}
                        </Button>
                      ))}
                    </form>
                  ) : (
                    <p className="text-muted-foreground">Tahle otázka je chybně položená; opraví se sama, nic nedělej.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : null}

      <footer className="flex flex-col gap-1 border-t pt-4 text-sm text-muted-foreground">
        <p>Mac se naposledy ozval {input.macAt ? formatPrague(input.macAt) : "— zatím nikdy"}.</p>
        {input.agent && (
          <p>
            Agent má ve frontě {input.agent.open} úkolů
            {input.agent.lastAnswerAt ? `, naposledy odpověděl ${formatPrague(input.agent.lastAnswerAt)}` : ""}.
          </p>
        )}
        <p>Načteno {formatPrague(input.now)}; stránka se obnovuje sama.</p>
      </footer>
    </div>
  );
}
