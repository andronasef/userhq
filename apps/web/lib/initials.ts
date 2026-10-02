export function initials(name: string): string {
  if (!name) return "";

  // Split into whitespace-separated words
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const result: string[] = [];

  for (const word of words) {
    if (result.length >= 2) break;
    // Find the first Unicode letter in the word
    const match = word.match(/\p{L}/u);
    if (match) {
      result.push(match[0].toUpperCase());
    }
  }

  return result.join("");
}
