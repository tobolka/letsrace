/** Cookie + localStorage key for the one-shot explore intro card. */
export const WELCOME_SEEN_KEY = "letsrace.welcome.seen";

/** Inline in <head> so returning visitors never paint the card for one frame. */
export const WELCOME_SEEN_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(WELCOME_SEEN_KEY)})==="1")document.documentElement.dataset.welcomeSeen="1"}catch(e){}`;

export function markWelcomeSeen() {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* private mode — dataset + cookie below still stop a later flash */
  }
  document.documentElement.dataset.welcomeSeen = "1";
  document.cookie = `${WELCOME_SEEN_KEY}=1; path=/; max-age=31536000; samesite=lax`;
}
