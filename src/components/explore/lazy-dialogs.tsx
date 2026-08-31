"use client";

import dynamic from "next/dynamic";

/**
 * Dialogs that only ever open from a click. Splitting them out keeps their code
 * — and the form, auth and validation machinery behind them — off the first
 * load of the explore page, where the map and the race list are what matter.
 */

export const SubmitRaceModalLazy = dynamic(
  () => import("@/components/explore/submit-race-modal").then((m) => m.SubmitRaceModal),
  { ssr: false },
);

export const FeedbackModalLazy = dynamic(
  () => import("@/components/explore/feedback-modal").then((m) => m.FeedbackModal),
  { ssr: false },
);

export const AuthDialogLazy = dynamic(
  () => import("@/components/account/auth-dialog").then((m) => m.AuthDialog),
  { ssr: false },
);
