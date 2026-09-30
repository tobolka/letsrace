import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth/admin";
import { alertEmail } from "@/lib/race-alerts-run";
import { digestEmail, planChangeEmail } from "@/lib/plan-mail-run";
import { asLocale } from "@/lib/i18n/messages";
import type { EventPlan } from "@/lib/planner";

/*
 * Every email the app sends, rendered with sample races, for an admin to look
 * at without waiting for a cron run: /api/admin/email-preview?kind=alert&l=cs
 * (kind: alert | change | digest; add &format=text for the plain-text part).
 */

const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

function plan(name: string, slug: string, startDate: string, place: string, disciplines: string[]): EventPlan {
  return {
    event: {
      id: slug,
      name,
      slug,
      startDate,
      endDate: null,
      level: null,
      classLabel: null,
      disciplines,
      place,
      countryCode: "CZ",
      registrationUrl: null,
      websiteUrl: null,
    },
    favorited: true,
    goingMemberIds: [],
    registered: false,
    paid: false,
    memberStatus: {},
    feeAmount: null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const kind = req.nextUrl.searchParams.get("kind") ?? "alert";
  const locale = asLocale(req.nextUrl.searchParams.get("l") ?? "cs");
  const asText = req.nextUrl.searchParams.get("format") === "text";

  const candidate = (name: string, slug: string, startDate: string, place: string, disciplines: string[]) => ({
    id: slug,
    name,
    slug,
    startDate,
    disciplines,
    status: "scheduled",
    visibility: "public",
    createdAt: startDate,
    lat: null,
    lng: null,
    place,
    countryCode: "CZ",
  });

  const mail =
    kind === "change"
      ? planChangeEmail(locale, SAMPLE_ID, [
          {
            event: { id: "a", name: "Bike Cup Beskydy", slug: "bike-cup-beskydy", startDate: "2026-10-11", endDate: null },
            kind: "date",
            payload: { from: "2026-10-04", to: "2026-10-11" },
            changeId: "c1",
          },
          {
            event: { id: "b", name: "Pražský MTB pohár — 4. kolo", slug: "prazsky-mtb-pohar-4", startDate: "2026-10-18", endDate: null },
            kind: "registration",
            payload: {},
            changeId: "c2",
          },
        ])
      : kind === "digest"
        ? digestEmail(locale, SAMPLE_ID, {
            thisWeekend: [plan("Bohnice — Velká cena Prahy 8", "bohnice-vc-prahy-8", "2026-10-03", "Praha", ["bmx"])],
            thisWeekendFree: false,
            needsAction: [plan("Kolo pro život — Jizerská 50", "jizerska-50", "2026-10-17", "Bedřichov", ["xcm"])],
            nextWeekendFree: true,
            nearby: { id: "n", name: "Cyklokros Kolín", slug: "cyklokros-kolin", startDate: "2026-10-25", km: 9, place: "Kolín" },
          })
        : alertEmail(locale, { id: SAMPLE_ID, label: "Praha", radiusKm: 50 }, [
            { event: candidate("Jizerský MTB pohár", "jizersky-mtb-pohar", "2026-10-10", "Liberec", ["xco"]), km: 18 },
            { event: candidate("Cyklokros Kolín", "cyklokros-kolin", "2026-10-25", "Kolín", ["cx"]), km: 42 },
            { event: candidate("Brdy Gravel", "brdy-gravel", "2026-11-01", "Příbram", ["gravel"]), km: 48 },
          ]);

  if (asText) return new NextResponse(mail.text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new NextResponse(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
