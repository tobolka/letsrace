/** Words as a page and a quote would agree on them: no case, no accents, punctuation and spacing as one gap. */
export const folded = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Is the quote on the page, word for word (case, accents and spacing aside)? */
export const quoteIsOn = (page: string, quote: string) => {
  const wanted = folded(quote);
  return wanted.length >= 6 && folded(page).includes(wanted);
};
