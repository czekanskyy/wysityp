import type { Span } from "./spans";

export type DollarEdit = {
  from: number;
  to: number;
  insert: string;
  selection: number;
};

/**
 * Typing `$` inserts a pair and leaves the caret inside.
 * Typing `$` when the next character is the closer steps over it.
 * A selection is wrapped. Inside an open formula, `$` stays a single character.
 */
export function dollarEdit(
  source: string,
  from: number,
  to: number,
  spans: Span[],
): DollarEdit | null {
  if (from !== to) {
    const inside = spans.some(
      (span) =>
        span.kind === "math" && span.closed && from > span.from && to < span.to,
    );
    if (inside) return null;
    const selected = source.slice(from, to);
    return { from, to, insert: `$${selected}$`, selection: to + 2 };
  }
  const next = source[from];
  const prev = from > 0 ? source[from - 1] : "";
  const inside = spans.some(
    (span) =>
      span.kind === "math" && span.closed && from > span.from && from < span.to,
  );
  if (next === "$" && (prev === "$" || inside)) {
    return { from, to, insert: "", selection: from + 1 };
  }
  if (prev === "\\") return null;
  if (inside) return null;
  return { from, to, insert: "$$", selection: from + 1 };
}

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  const whole = Math.floor(value);
  if (whole < 1) return 1;
  if (whole > max) return max;
  return whole;
}

/** A Typst table skeleton. The call stays source; this only inserts it. */
export function tableSkeleton(rows: number, cols: number): string {
  const rowCount = clampCount(rows, 12);
  const colCount = clampCount(cols, 12);
  const columns = Array.from({ length: colCount }, () => "1fr").join(", ");
  const cells = Array.from({ length: colCount }, () => "[]").join(", ");
  const lines = ["#table(", `  columns: (${columns}),`];
  for (let row = 0; row < rowCount; row += 1) lines.push(`  ${cells},`);
  lines.push(")");
  return lines.join("\n");
}

export function codeBlockSkeleton(lang?: string): {
  text: string;
  cursor: number;
} {
  const clean = (lang ?? "").trim().replace(/[^\w+-]/g, "");
  const open = clean ? `\`\`\`${clean}\n` : "```\n";
  return { text: `${open}\n\`\`\``, cursor: open.length };
}

export function mathSkeleton(
  block: boolean,
  selected = "",
): { text: string; cursor: number } {
  if (block) {
    if (selected) {
      const text = `$\n  ${selected}\n$`;
      return { text, cursor: text.length };
    }
    return { text: "$\n  \n$", cursor: 4 };
  }
  if (selected) {
    const text = `$${selected}$`;
    return { text, cursor: text.length };
  }
  return { text: "$$", cursor: 1 };
}

export function linkSkeleton(selected = ""): {
  text: string;
  selectFrom: number;
  selectTo: number;
} {
  const text = `#link("https://")[${selected}]`;
  const selectFrom = '#link("'.length;
  return { text, selectFrom, selectTo: selectFrom + "https://".length };
}
