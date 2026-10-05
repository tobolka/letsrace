/** Icon-only links can carry their document name in accessibility attributes. */
export function linkLabel(element: { text(): string; attr(name: string): string | undefined; find(selector: string): { attr(name: string): string | undefined } }): string {
  return [...new Set([element.text(), element.attr("aria-label"), element.attr("title"), element.find("img").attr("alt")]
    .filter((text): text is string => Boolean(text?.trim())).map((text) => text.replace(/\s+/g, " ").trim()))].join(" ");
}
