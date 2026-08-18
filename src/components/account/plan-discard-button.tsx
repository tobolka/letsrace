"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { messagesFor } from "@/lib/i18n/messages";

export function PlanDiscardButton({
  locale,
  eventName,
  disabled,
  iconOnly,
  onConfirm,
}: {
  locale: string;
  eventName: string;
  disabled?: boolean;
  iconOnly?: boolean;
  onConfirm: () => void;
}) {
  const t = messagesFor(locale);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={t.planDiscard}
          >
            <Trash2 />
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={disabled}>
            <Trash2 data-icon="inline-start" />
            {t.planDiscard}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.planDiscardTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {eventName}. {t.planDiscardBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t.planDiscard}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
