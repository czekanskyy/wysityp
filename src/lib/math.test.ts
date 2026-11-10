import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MATH_SIZE_PT,
  MathBatcher,
  PAGE_TEXT,
  extractMathPreamble,
  mathCacheKey,
  sanitizeSvg,
} from "./math";
import type { FormulaJob } from "./math";

const job = (source: string, color = PAGE_TEXT.white): FormulaJob => ({
  source,
  block: false,
  color,
  sizePt: MATH_SIZE_PT,
});

describe("extractMathPreamble", () => {
  it("keeps definitions and drops a page set", () => {
    const source = [
      "#let twice(x) = x + x",
      '#set page(paper: "a4")',
      "#set text(size: 12pt)",
      "",
      "Cześć $x$",
    ].join("\n");
    expect(extractMathPreamble(source)).toBe(
      "#let twice(x) = x + x\n#set text(size: 12pt)",
    );
  });

  it("keeps a let that spans lines", () => {
    const source = "#let f(x) = {\n  x + 1\n}\nBody\n";
    expect(extractMathPreamble(source)).toBe("#let f(x) = {\n  x + 1\n}");
  });
});

describe("sanitizeSvg", () => {
  it("drops a script and a script url", () => {
    const cleaned = sanitizeSvg(
      '<svg><script>alert(1)</script><path d="M0 0"/></svg>',
    );
    expect(cleaned.toLowerCase()).not.toContain("<script");
    expect(cleaned).toContain("<path");
    expect(sanitizeSvg('<svg href="javascript:alert(1)"/>')).not.toContain(
      "javascript:",
    );
  });
});

describe("MathBatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits, then does not render a cached formula again", async () => {
    vi.useFakeTimers();
    const calls: string[][] = [];
    const batcher = new MathBatcher(
      async (_path, _preamble, formulas) => {
        calls.push(formulas.map((formula) => formula.source));
        return formulas.map((formula) => ({
          id: formula.id,
          svg: `<svg>${formula.source}</svg>`,
          width_px: 10,
          height_px: 8,
          baseline_px: 6,
          error: "",
        }));
      },
      () => {},
    );
    const first = job("x");
    batcher.schedule([first], "", first.color, first.sizePt, "note.typ");
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(80);
    expect(calls).toEqual([["x"]]);
    batcher.schedule([first], "", first.color, first.sizePt, "note.typ");
    await batcher.flush();
    expect(calls).toEqual([["x"]]);
    const paint = batcher.snapshot().paints.get(mathCacheKey(first, ""));
    expect(paint?.svg).toContain("x");
    expect(paint?.url).toBe("");
  });

  it("sends at most 32 formulas in one batch", async () => {
    const sizes: number[] = [];
    const batcher = new MathBatcher(
      async (_path, _preamble, formulas) => {
        sizes.push(formulas.length);
        return formulas.map((formula) => ({
          id: formula.id,
          svg: "<svg></svg>",
          width_px: 4,
          height_px: 4,
          baseline_px: 3,
          error: "",
        }));
      },
      () => {},
    );
    const jobs = Array.from({ length: 40 }, (_, index) => job(`x${index}`));
    batcher.schedule(jobs, "", PAGE_TEXT.white, MATH_SIZE_PT, "");
    await batcher.flush();
    expect(sizes).toEqual([32, 8]);
  });

  it("stores the error when rendering throws", async () => {
    const batcher = new MathBatcher(
      async () => {
        throw new Error("engine down");
      },
      () => {},
    );
    const broken = job("1 +)");
    batcher.schedule([broken], "", broken.color, broken.sizePt, "");
    await batcher.flush();
    const paint = batcher.snapshot().paints.get(mathCacheKey(broken, ""));
    expect(paint?.error).toBe("engine down");
    expect(paint?.svg).toBe("");
  });

  it("changes the cache key when the colour or a let changes", () => {
    const white = job("x", PAGE_TEXT.white);
    const dark = job("x", PAGE_TEXT.oled);
    expect(mathCacheKey(white, "")).not.toBe(mathCacheKey(dark, ""));
    expect(mathCacheKey(white, "#let a = 1")).not.toBe(
      mathCacheKey(white, "#let a = 2"),
    );
  });
});
