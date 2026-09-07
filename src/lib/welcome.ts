/** Cookie + localStorage key for the one-shot explore intro card. */
export const WELCOME_SEEN_KEY = "letsrace.welcome.seen";

export function markWelcomeSeen() {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* private mode — cookie below is enough for the next SSR pass */
  }
  // Readable on the server so returning visitors never pay the preload or the
  // LCP tax of an image that will not be shown.
  document.cookie = `${WELCOME_SEEN_KEY}=1; path=/; max-age=31536000; samesite=lax`;
}
