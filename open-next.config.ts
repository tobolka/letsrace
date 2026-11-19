import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"

// Prerendered pages are read from the deployed static assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
})
