import type { MetadataRoute } from "next";
import { SITE_NAME, seoCopy } from "@/lib/seo";

/**
 * Lets a phone put Let's Race on its home screen and open it full screen,
 * without the browser's address bar.
 *
 * `start_url` is the bare root on purpose: the proxy sends it on to the
 * language the visitor last chose (or their browser's), so one manifest serves
 * every language. No service worker: installing no longer needs one, and an
 * offline copy of a race calendar would only show stale dates.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: seoCopy.en.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fafaf9",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
