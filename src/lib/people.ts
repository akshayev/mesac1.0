/** First letters of up to two words: "Jane Q. Doe" -> "JQ". */
export function getInitials(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, "")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => (w.match(/[\p{L}\p{N}]/u)?.[0] ?? "").toUpperCase())
    .join("");
}
