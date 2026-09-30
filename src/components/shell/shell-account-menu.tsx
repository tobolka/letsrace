"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapAccountButton } from "@/components/explore/map-account-button";
import { messagesFor } from "@/lib/i18n/messages";

const SubmitRaceModal = dynamic(() =>
  import("@/components/explore/submit-race-modal").then((m) => ({ default: m.SubmitRaceModal })),
);
const FeedbackModal = dynamic(() =>
  import("@/components/explore/feedback-modal").then((m) => ({ default: m.FeedbackModal })),
);
const AuthDialog = dynamic(() =>
  import("@/components/account/auth-dialog").then((m) => ({ default: m.AuthDialog })),
);

/**
 * The account control the map wears in its corner, for every other page in the
 * frame: who is signed in, the language, the way to report a missing race. The
 * dialogs it opens live here too, so a page does not need to know about them.
 */
export function ShellAccountMenu({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <MapAccountButton
        locale={locale}
        messages={t}
        variant="bar"
        onSignIn={() => setAuthOpen(true)}
        onSubmitRace={() => setSubmitOpen(true)}
        onFeedback={() => setFeedbackOpen(true)}
      />
      {submitOpen ? <SubmitRaceModal open onClose={() => setSubmitOpen(false)} messages={t} /> : null}
      {feedbackOpen ? <FeedbackModal open onClose={() => setFeedbackOpen(false)} /> : null}
      {authOpen ? (
        <AuthDialog
          open
          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
          locale={locale}
        />
      ) : null}
    </>
  );
}
