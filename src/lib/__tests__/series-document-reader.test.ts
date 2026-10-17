import { expect, it } from "vitest";
import { seriesDocumentPrompt, SERIES_DOCUMENT_MAX_BYTES } from "@/lib/catalog/series-document-reader";

it("keeps the full long document and original line numbers, including late exceptions", () => {
  const text = `JANEV CUP 2026\n${Array.from({ length: 1000 }, (_, i) => `Rule ${i}: published official race rule`).join("\n")}\nU11\nU13\nFinal round excludes U11`;
  const prompt = seriesDocumentPrompt("JANEV Cup", [], "https://example.com/rules.pdf", text);
  expect(text.length).toBeGreaterThan(14_000);
  expect(prompt?.user).toContain("1002. U11\n1003. U13\n1004. Final round excludes U11");
});

it("does not turn a partial oversized document into exhaustive category evidence", () => {
  expect(seriesDocumentPrompt("Cup", [], "https://example.com/rules", "x".repeat(SERIES_DOCUMENT_MAX_BYTES + 1))).toBeNull();
});
