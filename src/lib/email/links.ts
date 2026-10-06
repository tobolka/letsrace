import { messagesFor } from "@/lib/i18n/messages";
import { getSiteUrl } from "@/lib/seo";
import { localePath } from "@/lib/localized-paths";
import { unsubscribeToken, type UnsubscribeTarget } from "@/lib/email/unsubscribe";

/**
 * The footer links and the headers that go with them.
 *
 * `List-Unsubscribe` with `List-Unsubscribe-Post` is RFC 8058 one-click
 * unsubscribe: Gmail and Yahoo show their own "Unsubscribe" button for it and
 * require it of anyone sending in bulk. It points at the same endpoint as the
 * link in the footer.
 */
export function emailFooterLinks(locale: string, target: UnsubscribeTarget) {
  const t = messagesFor(locale);
  const origin = getSiteUrl();
  const token = unsubscribeToken(target);
  const unsubscribeHref = token ? `${origin}/api/email/unsubscribe?t=${token}&l=${locale}` : null;
  return {
    manage: { label: t.emailManage, href: `${origin}${localePath(locale, "account/settings")}` },
    unsubscribe: unsubscribeHref ? { label: t.emailUnsubscribe, href: unsubscribeHref } : undefined,
    headers: unsubscribeHref
      ? { "List-Unsubscribe": `<${unsubscribeHref}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  };
}
