/**
 * Undo the oldest mistake in scraping: Windows-1252 read as Latin-1.
 *
 * A German organiser writes "Pott’s Leeze Tour". Their page is Windows-1252,
 * where the apostrophe is byte 0x92; something upstream decoded it as Latin-1,
 * where 0x92 is a control character nobody has a glyph for. It reaches us as
 * U+0092 and the browser draws an empty box in the middle of the name.
 *
 * The bytes are not lost, only mislabelled, so the mapping back is exact: the
 * C1 block is what Windows-1252 fills with punctuation. Anything left in that
 * block with no character behind it is dropped rather than shown, because a
 * missing apostrophe reads better than a hole.
 */

const CP1252: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

/** Control characters that never belong in a race name. */
// eslint-disable-next-line no-control-regex
const C1 = /[\u0080-\u009f]/g;
// eslint-disable-next-line no-control-regex
const C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function repairText<T extends string | null | undefined>(value: T): T {
  if (!value) return value;
  if (!C1.test(value) && !C0.test(value)) return value;
  C1.lastIndex = 0;
  C0.lastIndex = 0;
  return value
    .replace(C1, (ch) => CP1252[ch.charCodeAt(0)] ?? "")
    .replace(C0, "") as T;
}
