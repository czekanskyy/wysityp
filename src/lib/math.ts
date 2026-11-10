import type { NotePageColor } from "./ui/types";

/** Glyph colour for each note page. These match the `--page-*-text` tokens. */
export const PAGE_TEXT: Record<NotePageColor, string> = {
  white: "#1f1d1a",
  beige: "#3a2f22",
  graphite: "#e6e2da",
  oled: "#d8d4cc",
};

/** 17px body type, in Typst points. */
export const MATH_SIZE_PT = (17 * 72) / 96;

export const MATH_DEBOUNCE_MS = 80;
export const MATH_BATCH_LIMIT = 32;

export type MathFormula = {
  id: string;
  source: string;
  block: boolean;
  color: string;
  size_pt: number;
};

export type MathSvg = {
  id: string;
  svg: string;
  width_px: number;
  height_px: number;
  baseline_px: number;
  error: string;
};

export type FormulaJob = {
  source: string;
  block: boolean;
  color: string;
  sizePt: number;
};

export type FormulaPaint = {
  svg: string;
  url: string;
  widthPx: number;
  heightPx: number;
  baselinePx: number;
  error: string;
};

export type BoxSize = {
  widthPx: number;
  heightPx: number;
};

export type MathSnapshot = {
  preamble: string;
  color: string;
  sizePt: number;
  paints: ReadonlyMap<string, FormulaPaint>;
  sizes: ReadonlyMap<string, BoxSize>;
};

const PREAMBLE_WORD = /^(let|import|set|show)$/u;

/**
 * Top level `#let`, `#import`, `#set`, and `#show` lines.
 * `#set page` is left out so a formula stays on a tiny transparent page.
 */
export function extractMathPreamble(source: string): string {
  const kept: string[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "\n") {
      i += 1;
      continue;
    }
    const atLineStart = i === 0 || source[i - 1] === "\n";
    if (!atLineStart || source[i] !== "#") {
      const next = source.indexOf("\n", i);
      i = next === -1 ? source.length : next + 1;
      continue;
    }
    const word = wordAfterHash(source, i);
    if (!word || !PREAMBLE_WORD.test(word)) {
      const next = source.indexOf("\n", i);
      i = next === -1 ? source.length : next + 1;
      continue;
    }
    const end = statementEnd(source, i);
    const statement = source.slice(i, end).trim();
    if (statement && !isSetPage(statement)) kept.push(statement);
    i = end;
    if (source[i] === "\n") i += 1;
  }
  return kept.join("\n");
}

function wordAfterHash(source: string, hashAt: number): string {
  let i = hashAt + 1;
  const start = i;
  while (i < source.length && /[\p{L}\p{N}_-]/u.test(source[i] ?? "")) i += 1;
  return source.slice(start, i);
}

function isSetPage(statement: string): boolean {
  const match = /^#set\s+([A-Za-z][\w-]*)/u.exec(statement.trim());
  return match?.[1] === "page";
}

function statementEnd(source: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/" && depth === 0) {
      const next = source.indexOf("\n", i);
      return next === -1 ? source.length : next;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close === -1 ? source.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = skipString(source, i);
      continue;
    }
    if (ch === "`") {
      let count = 0;
      while (source[i + count] === "`") count += 1;
      const needle = "`".repeat(count);
      const close = source.indexOf(needle, i + count);
      i = close === -1 ? source.length : close + count;
      continue;
    }
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}")
      depth = Math.max(0, depth - 1);
    else if (ch === "\n" && depth === 0) return i;
    i += 1;
  }
  return source.length;
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    if (source[i] === "\n") return i;
    i += 1;
  }
  return source.length;
}

/** Cache identity. The preamble is included so a `#let` change redraws. */
export function mathCacheKey(job: FormulaJob, preamble: string): string {
  const size = Math.round(job.sizePt * 100) / 100;
  return JSON.stringify([job.source, job.block, job.color, size, preamble]);
}

export function sizeKey(source: string, block: boolean): string {
  return JSON.stringify([source, block]);
}

export function emptyMathSnapshot(color: string, sizePt: number): MathSnapshot {
  return {
    preamble: "",
    color,
    sizePt,
    paints: new Map(),
    sizes: new Map(),
  };
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/javascript:/gi, "");
}

type RenderMath = (
  notePath: string,
  preamble: string,
  formulas: MathFormula[],
) => Promise<MathSvg[]>;

/**
 * Debounced batch of formula renders. A cached formula is never sent again.
 * Call `flush` from tests to skip the wait.
 */
export class MathBatcher {
  private readonly paints = new Map<string, FormulaPaint>();
  private readonly sizes = new Map<string, BoxSize>();
  private readonly pending = new Map<string, FormulaJob>();
  private preamble = "";
  private color = PAGE_TEXT.white;
  private sizePt = MATH_SIZE_PT;
  private notePath = "";
  private published = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flying = false;
  private dirty = false;

  constructor(
    private readonly render: RenderMath,
    private readonly onUpdate: () => void,
    private readonly delay = MATH_DEBOUNCE_MS,
  ) {}

  snapshot(): MathSnapshot {
    return {
      preamble: this.preamble,
      color: this.color,
      sizePt: this.sizePt,
      paints: this.paints,
      sizes: this.sizes,
    };
  }

  schedule(
    jobs: FormulaJob[],
    preamble: string,
    color: string,
    sizePt: number,
    notePath: string,
  ): void {
    this.preamble = preamble;
    this.color = color;
    this.sizePt = sizePt;
    this.notePath = notePath;
    const meta = `${color}\0${sizePt}\0${preamble}`;
    let missing = false;
    for (const job of jobs) {
      const key = mathCacheKey(job, preamble);
      if (this.paints.has(key)) continue;
      this.pending.set(key, job);
      missing = true;
    }
    if (meta !== this.published) {
      this.published = meta;
      this.onUpdate();
    }
    if (!missing) return;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.kick();
    }, this.delay);
  }

  /** Run a pending batch now. Tests use this instead of the timer. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.kick();
    if (this.dirty || this.pending.size > 0) await this.kick();
  }

  private async kick(): Promise<void> {
    if (this.flying) return;
    const jobs: { key: string; job: FormulaJob }[] = [];
    for (const [key, job] of this.pending) {
      if (this.paints.has(key)) {
        this.pending.delete(key);
        continue;
      }
      jobs.push({ key, job });
      if (jobs.length >= MATH_BATCH_LIMIT) break;
    }
    for (const item of jobs) this.pending.delete(item.key);
    this.dirty = this.pending.size > 0;
    if (jobs.length === 0) {
      this.onUpdate();
      return;
    }
    const preamble = this.preamble;
    const formulas: MathFormula[] = jobs.map((item, index) => ({
      id: String(index),
      source: item.job.source,
      block: item.job.block,
      color: item.job.color,
      size_pt: item.job.sizePt,
    }));
    this.flying = true;
    try {
      const results = await this.render(this.notePath, preamble, formulas);
      for (const result of results) {
        const index = Number(result.id);
        const item = jobs[index];
        if (!item) continue;
        const paint: FormulaPaint = {
          svg: result.error ? "" : sanitizeSvg(result.svg),
          url: "",
          widthPx: result.width_px,
          heightPx: result.height_px,
          baselinePx: result.baseline_px,
          error: result.error,
        };
        this.paints.set(mathCacheKey(item.job, preamble), paint);
        if (!paint.error && paint.widthPx > 0 && paint.heightPx > 0) {
          this.sizes.set(sizeKey(item.job.source, item.job.block), {
            widthPx: paint.widthPx,
            heightPx: paint.heightPx,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const item of jobs) {
        this.paints.set(mathCacheKey(item.job, preamble), {
          svg: "",
          url: "",
          widthPx: 0,
          heightPx: 0,
          baselinePx: 0,
          error: message,
        });
      }
    } finally {
      this.flying = false;
    }
    this.onUpdate();
    if (this.dirty) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.kick();
      }, this.delay);
    }
  }
}
