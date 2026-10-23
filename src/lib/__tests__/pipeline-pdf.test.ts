import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/http/safe-url", async original => ({ ...await original<typeof import("@/lib/http/safe-url")>(), fetchPublic: mocks.fetch }));
vi.mock("@/lib/catalog/regulation-ages", () => ({ pdfText: mocks.pdf }));
import { fetchPage } from "@/lib/watcher/http";

it("passes PDF text through the same extraction path without interpreting it as HTML", async () => {
  mocks.fetch.mockResolvedValue(new Response("%PDF fixture", { headers: { "content-type": "application/pdf" } }));
  mocks.pdf.mockResolvedValue("11.10.2026 Perlcross <script>untrusted</script>");
  const read = await fetchPage("https://club.test/calendar.pdf", { skipGate: true, retries: 0 });
  expect(read.html).toContain("11.10.2026 Perlcross");
  expect(read.html).toContain("&lt;script&gt;");
  expect(read.contentType).toBe("application/pdf");
});

it("reports a scanned PDF as unsupported instead of a successful empty calendar", async () => {
  mocks.fetch.mockResolvedValue(new Response("%PDF fixture", { headers: { "content-type": "application/pdf" } }));
  mocks.pdf.mockResolvedValue("");
  await expect(fetchPage("https://club.test/scanned.pdf", { skipGate: true, retries: 0 })).rejects.toThrow("pdf_has_no_text");
});
