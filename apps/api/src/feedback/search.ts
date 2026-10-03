/**
 * Full-text search query helper for feedback posts.
 * Extracts Unicode letter and digit runs, joins stems with ' & ',
 * and adds prefix match ':*' to the final token.
 */
export function prefixTsQuery(q: string): string | null {
  if (!q) return null;
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!words || words.length === 0) {
    return null;
  }
  if (words.length === 1) {
    return `${words[0]}:*`;
  }
  const prefixWord = words[words.length - 1];
  const stemWords = words.slice(0, words.length - 1);
  return `${stemWords.join(" & ")} & ${prefixWord}:*`;
}
