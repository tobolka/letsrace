/**
 * Fetch club pages and print the best propozice / regulations URL.
 * Usage: nvm use 22 && npx tsx scripts/find-regulations.ts <url> [<url>...]
 */
import { fetchPage } from "../src/lib/watcher/http";
import { findRegulationsUrl } from "../src/lib/watcher/regulations-url";

async function main() {
  const urls = process.argv.slice(2).filter((u) => /^https?:\/\//i.test(u));
  if (!urls.length) {
    console.error("Pass one or more page URLs");
    process.exit(1);
  }

  const results: { page: string; status: number; regulations: string | null }[] = [];

  for (const page of urls) {
    try {
      const fetched = await fetchPage(page, { timeoutMs: 12_000, retries: 1 });
      const regulations = findRegulationsUrl(page, fetched.html);
      results.push({ page, status: fetched.status, regulations });
      console.error(`${fetched.status} ${page} -> ${regulations ?? "(none)"}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ page, status: 0, regulations: null });
      console.error(`ERR ${page} -> ${message}`);
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
