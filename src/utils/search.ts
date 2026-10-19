/** Whether `query` starts `text` or one of its words. */
function startsWord(text: string, query: string): boolean {
  for (
    let at = text.indexOf(query);
    at >= 0;
    at = text.indexOf(query, at + 1)
  ) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1])) return true;
  }
  return false;
}

/**
 * How well a Start menu or command palette entry matches a search: 0 when
 * the query starts the name or a word in it, 1 for the rest of the name, 2
 * for the description, and -1 for no match. All three are compared in lower
 * case, so pass lowercase text.
 */
export function rankMatch(
  name: string,
  description: string,
  query: string,
): number {
  if (startsWord(name, query)) return 0;
  if (name.includes(query)) return 1;
  return description.includes(query) ? 2 : -1;
}
