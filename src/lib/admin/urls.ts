export function openableUrl(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function firstOpenableUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    const url = openableUrl(candidate);
    if (url) return url;
  }
  return null;
}
