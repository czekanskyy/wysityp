import type { IconName } from "./icons";

export interface Command {
  id: string;
  title: string;
  /** Group heading in the palette, e.g. "Notatki" or "Wstaw". */
  group?: string;
  icon?: IconName;
  /** Shortcut keys shown on the right, e.g. ["Ctrl", "K"]. */
  shortcut?: string[];
  /** Extra words that should find this command (synonyms, the other language). */
  keywords?: string[];
  run: () => void;
}

/** Lower case and strip accents, so "zrodlo" finds "Źródło". */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/ł/g, "l");
}

function score(command: Command, words: string[]): number {
  const title = foldText(command.title);
  const extra = foldText((command.keywords ?? []).join(" "));
  let total = 0;
  for (const word of words) {
    if (title.startsWith(word)) total += 4;
    else if (title.includes(` ${word}`)) total += 3;
    else if (title.includes(word)) total += 2;
    else if (extra.includes(word)) total += 1;
    else return 0;
  }
  return total;
}

/**
 * Commands that match every word of the query, best first. An empty query
 * keeps the given order. Ties keep the given order too.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands
    .map((command, index) => ({ command, index, score: score(command, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}
