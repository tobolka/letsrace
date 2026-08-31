"use client";

import { useEffect } from "react";

/** Keep `<html lang>` in sync without calling `headers()` in the root layout (which forces no-store). */
export function LocaleHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null;
}
