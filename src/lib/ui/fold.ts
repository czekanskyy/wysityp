const folds: readonly (readonly [string, string])[] = [
  ["ą", "a"],
  ["ć", "c"],
  ["ę", "e"],
  ["ł", "l"],
  ["ń", "n"],
  ["ó", "o"],
  ["ś", "s"],
  ["ź", "z"],
  ["ż", "z"],
];

export function foldPolish(value: string): string {
  let folded = value.toLocaleLowerCase("pl");
  for (const [from, to] of folds) folded = folded.replaceAll(from, to);
  return folded;
}

export function commandMatches(label: string, query: string): boolean {
  const needle = foldPolish(query.trim());
  if (needle.length === 0) return true;
  return foldPolish(label).includes(needle);
}

/** Higher is a closer match. Zero means the query is not a subsequence. */
export function fuzzyScore(label: string, query: string): number {
  const needle = foldPolish(query.trim());
  if (needle.length === 0) return 1;
  const hay = foldPolish(label);
  if (hay === needle) return 1000;
  if (hay.startsWith(needle)) return 800;
  const words = hay.split(/[^a-z0-9]+/);
  if (words.some((word) => word.startsWith(needle))) return 700;
  const at = hay.indexOf(needle);
  if (at >= 0) return 500 - at;

  let cursor = 0;
  let run = 0;
  let bestRun = 0;
  let gaps = 0;
  for (const character of needle) {
    const found = hay.indexOf(character, cursor);
    if (found < 0) return 0;
    if (found === cursor) {
      run += 1;
      if (run > bestRun) bestRun = run;
    } else {
      gaps += found - cursor;
      run = 1;
    }
    cursor = found + 1;
  }
  const score = 200 + bestRun * 20 - gaps;
  return score > 0 ? score : 1;
}

export function rankByFuzzy<T>(
  items: readonly T[],
  query: string,
  labelOf: (item: T) => string,
): T[] {
  const ranked = items.map((item, index) => ({
    item,
    index,
    score: fuzzyScore(labelOf(item), query),
  }));
  return ranked
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}
