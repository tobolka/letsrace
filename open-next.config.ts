import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The plain setup: no shared page cache yet. A real move needs one (R2), see the trial result.
export default defineCloudflareConfig({});
