/** Source edits for the formatting toolbar. Pure functions so tests can
 * check Polish text and a selection without a window. */

export type RangeEdit = {
  from: number;
  to: number;
  insert: string;
  anchor: number;
  head: number;
};

export type FormatAction =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "bullet"
  | "numbered"
  | "quote"
  | "heading-0"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "math-inline"
  | "math-block"
  | "code-block"
  | "link"
  | "table";

export type FormatEditor = {
  getText(): string;
  getPlace(): { anchor: number; head: number };
  replaceRange(
    from: number,
    to: number,
    insert: string,
    anchor: number,
    head: number,
  ): void;
  focus(): void;
  insertTable?(rows: number, cols: number): void;
  insertCodeBlock?(lang?: string): void;
  insertMath?(block: boolean): void;
  insertLink?(): void;
  insertImageFromDialog?(): void;
};

type Line = { from: number; to: number; text: string };

const MAX_TABLE = 12;

export function applyRange(source: string, edit: RangeEdit): string {
  return source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
}

export function tableSkeleton(rows: number, cols: number): string {
  const rowCount = clampCount(rows);
  const colCount = clampCount(cols);
  const columns = Array.from({ length: colCount }, () => "1fr").join(", ");
  const cells = Array.from({ length: colCount }, () => "[]").join(", ");
  const lines = ["#table(", `  columns: (${columns}),`];
  for (let row = 0; row < rowCount; row += 1) lines.push(`  ${cells},`);
  lines.push(")");
  return lines.join("\n");
}

export function codeBlockSkeleton(
  lang?: string,
  selected = "",
): { text: string; cursor: number } {
  const clean = (lang ?? "").trim().replace(/[^\w+-]/g, "");
  const open = clean ? `\`\`\`${clean}\n` : "```\n";
  const body = selected ? `${selected}\n` : "\n";
  return {
    text: `${open}${body}\`\`\``,
    cursor: open.length + selected.length,
  };
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

export function formatEdit(
  source: string,
  from: number,
  to: number,
  action: FormatAction,
  options?: { rows?: number; cols?: number },
): RangeEdit {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const selected = source.slice(start, end);
  if (action === "bold") return wrap(source, start, end, "*", "*");
  if (action === "italic") return wrap(source, start, end, "_", "_");
  if (action === "underline")
    return wrap(source, start, end, "#underline[", "]");
  if (action === "strike") return wrap(source, start, end, "#strike[", "]");
  if (action === "code") return wrap(source, start, end, "`", "`");
  if (action === "quote") return wrap(source, start, end, "#quote[", "]");
  if (action === "bullet") return linePrefix(source, start, end, "- ");
  if (action === "numbered") return linePrefix(source, start, end, "+ ");
  if (action === "heading-0") return heading(source, start, end, 0);
  if (action === "heading-1") return heading(source, start, end, 1);
  if (action === "heading-2") return heading(source, start, end, 2);
  if (action === "heading-3") return heading(source, start, end, 3);
  if (action === "math-inline" || action === "math-block") {
    const skeleton = mathSkeleton(action === "math-block", selected);
    return placed(start, end, skeleton.text, skeleton.cursor, skeleton.cursor);
  }
  if (action === "code-block") {
    const skeleton = codeBlockSkeleton(undefined, selected);
    return placed(start, end, skeleton.text, skeleton.cursor, skeleton.cursor);
  }
  if (action === "link") {
    const skeleton = linkSkeleton(selected);
    return placed(
      start,
      end,
      skeleton.text,
      skeleton.selectFrom,
      skeleton.selectTo,
    );
  }
  const text = tableSkeleton(options?.rows ?? 2, options?.cols ?? 2);
  return placed(start, end, text, text.length, text.length);
}

/** Prefer the editor helpers once they exist. Until then, insert the same
 * source with a range replace. */
export function runFormat(
  editor: FormatEditor,
  action: FormatAction,
  options?: { rows?: number; cols?: number },
): void {
  if (action === "math-inline" && editor.insertMath) {
    editor.insertMath(false);
    return;
  }
  if (action === "math-block" && editor.insertMath) {
    editor.insertMath(true);
    return;
  }
  if (action === "code-block" && editor.insertCodeBlock) {
    editor.insertCodeBlock();
    return;
  }
  if (action === "link" && editor.insertLink) {
    editor.insertLink();
    return;
  }
  if (action === "table" && editor.insertTable) {
    editor.insertTable(options?.rows ?? 2, options?.cols ?? 2);
    return;
  }
  const place = editor.getPlace();
  const edit = formatEdit(
    editor.getText(),
    place.anchor,
    place.head,
    action,
    options,
  );
  editor.replaceRange(edit.from, edit.to, edit.insert, edit.anchor, edit.head);
}

export function canInsertImage(editor: object): boolean {
  return typeof (editor as FormatEditor).insertImageFromDialog === "function";
}

export function runImage(editor: FormatEditor): void {
  editor.insertImageFromDialog?.();
}

export const formatShortcut: Partial<Record<FormatAction, readonly string[]>> =
  {
    bold: ["Ctrl", "B"],
    italic: ["Ctrl", "I"],
    underline: ["Ctrl", "U"],
    strike: ["Ctrl", "Shift", "X"],
    code: ["Ctrl", "E"],
    quote: ["Ctrl", "Shift", "Q"],
    "heading-0": ["Ctrl", "Alt", "0"],
    "heading-1": ["Ctrl", "Alt", "1"],
    "heading-2": ["Ctrl", "Alt", "2"],
    "heading-3": ["Ctrl", "Alt", "3"],
    "math-inline": ["Ctrl", "M"],
    "math-block": ["Ctrl", "Shift", "M"],
    "code-block": ["Ctrl", "Shift", "K"],
    link: ["Ctrl", "K"],
  };

export const formatCmKeys: readonly { action: FormatAction; key: string }[] = [
  { action: "bold", key: "Mod-b" },
  { action: "italic", key: "Mod-i" },
  { action: "underline", key: "Mod-u" },
  { action: "strike", key: "Mod-Shift-x" },
  { action: "code", key: "Mod-e" },
  { action: "quote", key: "Mod-Shift-q" },
  { action: "heading-0", key: "Mod-Alt-0" },
  { action: "heading-1", key: "Mod-Alt-1" },
  { action: "heading-2", key: "Mod-Alt-2" },
  { action: "heading-3", key: "Mod-Alt-3" },
  { action: "math-inline", key: "Mod-m" },
  { action: "math-block", key: "Mod-Shift-m" },
  { action: "code-block", key: "Mod-Shift-k" },
  { action: "link", key: "Mod-k" },
];

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const whole = Math.floor(value);
  if (whole < 1) return 1;
  if (whole > MAX_TABLE) return MAX_TABLE;
  return whole;
}

function wrap(
  source: string,
  start: number,
  end: number,
  before: string,
  after: string,
): RangeEdit {
  const selected = source.slice(start, end);
  return placed(
    start,
    end,
    before + selected + after,
    before.length,
    before.length + selected.length,
  );
}

function placed(
  start: number,
  end: number,
  insert: string,
  cursorFrom: number,
  cursorTo: number,
): RangeEdit {
  return {
    from: start,
    to: end,
    insert,
    anchor: start + cursorFrom,
    head: start + cursorTo,
  };
}

function linesOf(source: string): Line[] {
  const lines: Line[] = [];
  let from = 0;
  for (const text of source.split("\n")) {
    lines.push({ from, to: from + text.length, text });
    from += text.length + 1;
  }
  return lines;
}

function affectedLineIndexes(
  source: string,
  from: number,
  to: number,
): number[] {
  const lines = linesOf(source);
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const picked: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const nextFrom = lines[index + 1]?.from ?? Number.POSITIVE_INFINITY;
    if (end === line.from && end > start) continue;
    const onLine = start >= line.from && start < nextFrom;
    const overlaps = start < nextFrom && end > line.from;
    if (start === end ? onLine : overlaps) picked.push(index);
  }
  if (picked.length === 0 && lines.length > 0) picked.push(lines.length - 1);
  return picked;
}

function rewriteLines(
  source: string,
  from: number,
  to: number,
  rewrite: (text: string) => string,
): RangeEdit {
  const lines = linesOf(source);
  const indexes = affectedLineIndexes(source, from, to);
  const first = indexes[0] ?? 0;
  const last = indexes[indexes.length - 1] ?? first;
  const parts: string[] = [];
  const deltas: number[] = [];
  for (let index = first; index <= last; index += 1) {
    const line = lines[index];
    const next = line ? rewrite(line.text) : "";
    parts.push(next);
    deltas.push(next.length - (line?.text.length ?? 0));
  }
  const regionFrom = lines[first]?.from ?? 0;
  const regionTo = lines[last]?.to ?? source.length;
  const mapPos = (pos: number) => {
    if (pos <= regionFrom) return pos;
    let shift = 0;
    for (let index = first; index <= last; index += 1) {
      const line = lines[index];
      const delta = deltas[index - first] ?? 0;
      if (!line) continue;
      if (pos <= line.from) return pos + shift;
      if (pos <= line.to) {
        const rel = Math.max(0, pos - line.from + delta);
        return line.from + shift + rel;
      }
      shift += delta;
    }
    return pos + shift;
  };
  return {
    from: regionFrom,
    to: regionTo,
    insert: parts.join("\n"),
    anchor: mapPos(from),
    head: mapPos(to),
  };
}

function heading(
  source: string,
  from: number,
  to: number,
  level: 0 | 1 | 2 | 3,
): RangeEdit {
  const want = level === 0 ? "" : `${"=".repeat(level)} `;
  return rewriteLines(source, from, to, (text) => {
    const marker = /^(=+) /.exec(text)?.[0] ?? "";
    return want + text.slice(marker.length);
  });
}

function linePrefix(
  source: string,
  from: number,
  to: number,
  prefix: string,
): RangeEdit {
  const lines = linesOf(source);
  const indexes = affectedLineIndexes(source, from, to);
  const remove = indexes.every((index) =>
    (lines[index]?.text ?? "").startsWith(prefix),
  );
  return rewriteLines(source, from, to, (text) => {
    if (remove)
      return text.startsWith(prefix) ? text.slice(prefix.length) : text;
    return prefix + text;
  });
}
