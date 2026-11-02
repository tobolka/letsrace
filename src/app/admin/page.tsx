import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { getOwnerOverview } from "@/lib/admin/owner-overview";
import { OwnerRefresh, OwnerRefreshButton } from "@/components/admin/owner-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { discoveryUrl } from "@/lib/discovery/plan";

export const dynamic = "force-dynamic";
function time(value: string | null) {
  return value ? new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Není potvrzený";
}
const optionsSchema=z.array(z.object({value:z.string().min(1).max(100),label:z.string().min(1).max(160)})).min(2).max(4);
const evidenceSchema=z.object({sources:z.array(z.object({url:z.string().max(2000),quote:z.string().max(800).optional()})).max(5).optional()});
export default async function AdminHomePage({searchParams}: {searchParams:Promise<{decision?:string;decisions?:string}>}) {
  await requireAdminPage();
  const params=await searchParams;
  const offset=Math.max(0,Math.min(10000,Number.parseInt(params.decisions??'0',10)||0));
  let o: Awaited<ReturnType<typeof getOwnerOverview>>;
  try { o = await getOwnerOverview(offset); }
  catch {
    return <section className="mx-auto flex w-full max-w-4xl flex-col gap-5"><OwnerRefresh/><h1 className="text-2xl font-semibold">Stav LetsRace není dostupný</h1><p>Přehled se nepodařilo načíst. Chybějící údaje nejsou nulová fronta ani potvrzení, že vše funguje.</p><OwnerRefreshButton/></section>;
  }
  const streams = [
    { title: "Hledání nových webů", mode: "Hledání automaticky", value: `Návrhy k prověření: ${o.newSourcesWaiting}`, text: "Hledá nové pořadatele a kalendáře. Návrh webu ještě není nový závod; samostatné přijetí všech návrhů není dokončené." },
    { title: "Nové závody ze známých webů", mode: "Pravidelný sběr", value: `Sledované zdroje: ${o.activeSources}`, text: "Čte známé weby a porovnává nálezy s katalogem. Nejasnou totožnost odkládá, aby nevytvářel další závod naslepo." },
    { title: "Doplňování existujících závodů", mode: "Část automaticky", value: "Weby, přihlášky a další dostupné údaje", text: "Doplňuje známé závody. AI má omezený režim a rozpočet; uložený údaj není automaticky nově ověřený údaj." },
    { title: "Ověřování sporných nálezů", mode: "Opakované čtení automaticky", value: `Podklady k posouzení: ${o.candidates}`, text: `Naplánované další kontroly: ${o.candidatesScheduled}. Samostatné posuzování a zveřejňování ještě není dokončené.` },
  ];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <OwnerRefresh />
      {params.decision && <p role="status" className="rounded-lg border p-4 text-sm">{params.decision==='saved'?'Rozhodnutí je uložené.':params.decision==='changed'?'Podklad se mezitím změnil nebo už má odpověď. Zkontroluj aktuální otázku.':'Odpověď se nepodařilo uložit. Vyber jednu z nabídnutých možností.'}</p>}
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">LetsRace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Stav a další práce</h1></div><Button asChild variant="outline"><Link href="/cs">Otevřít LetsRace</Link></Button></header>
      <Card><CardHeader><Badge variant={o.state.tone === "good" ? "secondary" : "outline"} className="mb-2">{o.state.tone === "good" ? "Provoz potvrzený" : o.state.tone === "muted" ? "Pozastaveno na Macu" : "Provoz s omezením"}</Badge><CardTitle className="text-2xl">{o.state.title}</CardTitle><CardDescription className="max-w-2xl text-sm leading-relaxed">{o.state.detail}</CardDescription></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Poslední hlášení Macu</dt><dd className="mt-1 font-medium">{time(o.macAt)}</dd></div><div><dt className="text-muted-foreground">Dokončená serverová kontrola</dt><dd className="mt-1 font-medium">{time(o.serverAt)}</dd></div></dl></CardContent></Card>
      <section aria-labelledby="owner-decisions" className="space-y-4">
        <h2 id="owner-decisions" className="text-lg font-semibold">Potřebuje něco tebe?</h2>
        {o.questionCount===0 ? <><p>Teď není připravená žádná konkrétní otázka k rozhodnutí.</p><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Čekající podklady jsou práce systému. Nemusíš spouštět sběrače ani schvalovat každý nález.</p></> : <>
          <p className="text-sm text-muted-foreground">Konkrétní rozhodnutí: {o.questionCount}. Technické fronty do tohoto počtu nepatří.</p>
          {o.questions.map(question=>{
            const options=optionsSchema.safeParse(question.options),evidence=evidenceSchema.safeParse(question.evidence);
            return <Card key={question.key}><CardHeader><CardTitle className="text-lg">{question.question}</CardTitle><CardDescription className="leading-relaxed">{question.reason}</CardDescription></CardHeader><CardContent className="space-y-4 text-sm">
              <p><strong>Doporučení:</strong> {question.recommendation}</p><p><strong>Když neodpovíš:</strong> {question.default_action}</p>
              {evidence.success && evidence.data.sources?.map(source=>{const url=discoveryUrl(source.url);return url?<div key={url} className="space-y-1"><a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">Otevřít podklad: {new URL(url).hostname}</a>{source.quote&&<p className="text-muted-foreground">{source.quote}</p>}</div>:null;})}
              {options.success?<form action="/api/admin/owner-decision" method="post" className="flex flex-wrap gap-3"><input type="hidden" name="key" value={question.key}/><input type="hidden" name="updatedAt" value={question.updated_at}/>{options.data.map(option=><Button key={option.value} name="answer" value={option.value} type="submit" variant="outline">{option.label}</Button>)}</form>:<p>Možnosti odpovědi zatím nejsou platné. Podklad potřebuje opravu; nejde o úkol pro tebe.</p>}
            </CardContent></Card>;
          })}
          <nav aria-label="Další rozhodnutí" className="flex flex-wrap gap-4">{offset>0&&<Link className="underline" href={`/admin?decisions=${Math.max(0,offset-20)}`}>Předchozí otázky</Link>}{offset+20<o.questionCount&&<Link className="underline" href={`/admin?decisions=${offset+20}`}>Další otázky</Link>}</nav>
        </>}
        {o.answersWaiting>0&&<p className="text-sm text-muted-foreground">Uložená rozhodnutí čekající na provedení: {o.answersWaiting}. Uložená odpověď ještě neznamená provedenou změnu.</p>}
      </section>
      <section aria-labelledby="system-work"><h2 id="system-work" className="text-lg font-semibold">Co systém dělá</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Čtyři činnosti nad jedním katalogem. Počty zdrojů a podkladů nejsou počty ověřených závodů.</p><div className="grid gap-4 md:grid-cols-2">{streams.map(stream => <Card key={stream.title}><CardHeader className="gap-2"><p className="text-xs text-muted-foreground">{stream.mode}</p><CardTitle className="text-base">{stream.title}</CardTitle><p className="text-sm font-medium tabular-nums">{stream.value}</p></CardHeader><CardContent className="text-sm leading-relaxed text-muted-foreground">{stream.text}</CardContent></Card>)}</div></section>
      <section aria-labelledby="public-results"><h2 id="public-results" className="text-lg font-semibold">Co se skutečně dostalo na web</h2><p className="mt-3 text-sm">{o.catalogueCheck ? `Poslední kontrola společného seznamu pro mapu a kalendář: ${time(o.catalogueCheck.verifiedAt)} · ${o.catalogueCheck.races} závodů odpovídá uloženým údajům.` : "Společný seznam pro mapu a kalendář zatím nemá dokončenou kontrolu."}</p><dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Kontroly jednotlivých detailů za 24 hodin</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{o.publicChecks24h}</dd></div><div><dt className="text-muted-foreground">Změny čekající na zveřejnění nebo kontrolu</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{o.publicationPending}</dd></div></dl><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Kontrola stránky ověřuje shodu s uloženou změnou. Není to nezávislé ověření pravdivosti závodu ani počet nových závodů.</p></section>
      <details className="rounded-lg border p-4 text-sm"><summary className="cursor-pointer font-medium">Omezení a podrobnosti</summary><div className="mt-4 space-y-3 leading-relaxed text-muted-foreground"><p>Skutečné chyby spojení nebo zpracování: <strong className="text-foreground">{o.broken}</strong>. Stránky čekající na jiný způsob čtení: <strong className="text-foreground">{o.unreadable}</strong>.</p><p>Další posouzení zdrojů: {o.sourceReview}. Čtení odložená kvůli omezením: {o.sourceDeferred}. Plánované kontroly se zpožděním přes 36 hodin: {o.overdueSources}.</p><p>Nejstarší neuzavřený podklad: {time(o.oldestCandidate)}. Historické pokusy nejsou počet aktuálních poruch.</p><p>Limit AI zůstává 0,50 USD za den a 5 USD za měsíc. Placené hledání je vypnuté. Při vypnutém Macu pokračují serverové kontroly; místní práce čeká.</p><Button asChild variant="outline"><Link href="/admin/tools">Otevřít servisní nástroje</Link></Button></div></details>
      <p className="text-xs text-muted-foreground">Přehled načten {time(new Date(o.now).toISOString())}; při otevřené stránce se obnovuje automaticky.</p>
    </div>
  );
}
