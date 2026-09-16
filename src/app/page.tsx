import { permanentRedirect } from "next/navigation";

/**
 * 308, not 307. A temporary redirect tells Google to keep `/` as the canonical
 * URL and file `/en` as its duplicate — which is exactly what Search Console
 * reported. Permanent hands the canonical to `/en`, where the page's own
 * <link rel="canonical"> already points.
 */
export default function Home() {
  permanentRedirect("/en");
}
