/** Cookie + localStorage key for the one-shot explore intro card. */
export const WELCOME_SEEN_KEY = "letsrace.welcome.seen";

/**
 * The Supabase browser client keeps its session in `sb-<ref>-auth-token`
 * cookies (chunked as `.0`, `.1` when long). Readable without loading the
 * client, which is the point: the intro pitches signing in, and someone who
 * already has should never see it — not even for the frame before hydration.
 */
export const AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

export function hasAuthCookie(): boolean {
  try {
    return AUTH_COOKIE_PATTERN.test(document.cookie);
  } catch {
    return false;
  }
}

/** Inline in <head> so returning visitors never paint the card for one frame. */
export const WELCOME_SEEN_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(WELCOME_SEEN_KEY)})==="1"||${AUTH_COOKIE_PATTERN.toString()}.test(document.cookie))document.documentElement.dataset.welcomeSeen="1"}catch(e){}`;

export function markWelcomeSeen() {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* private mode — dataset + cookie below still stop a later flash */
  }
  document.documentElement.dataset.welcomeSeen = "1";
  document.cookie = `${WELCOME_SEEN_KEY}=1; path=/; max-age=31536000; samesite=lax`;
}
