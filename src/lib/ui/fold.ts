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
