import { describe, expect, it } from "vitest";
import {
  codeBlockSkeleton,
  dollarEdit,
  linkSkeleton,
  mathSkeleton,
  tableSkeleton,
} from "./insert";
import type { Span } from "./spans";

function mathSpan(from: number, to: number): Span {
  return {
    from,
    to,
    kind: "math",
    level: null,
    marker: "$",
    closed: true,
    block: false,
  };
}

describe("dollarEdit", () => {
  it("inserts a pair and leaves the caret inside", () => {
    expect(dollarEdit("ab", 1, 1, [])).toEqual({
      from: 1,
      to: 1,
      insert: "$$",
      selection: 2,
    });
  });

  it("steps over a closer that was just opened", () => {
    const source = "$$";
    expect(dollarEdit(source, 1, 1, [mathSpan(0, 2)])).toEqual({
      from: 1,
      to: 1,
      insert: "",
      selection: 2,
    });
  });

  it("leaves a dollar inside a formula as one character", () => {
    expect(dollarEdit("$x$", 1, 1, [mathSpan(0, 3)])).toBeNull();
  });

  it("steps over the closing dollar", () => {
    expect(dollarEdit("$x$", 2, 2, [mathSpan(0, 3)])).toEqual({
      from: 2,
      to: 2,
      insert: "",
      selection: 3,
    });
  });

  it("does not pair an escaped dollar", () => {
    expect(dollarEdit("\\", 1, 1, [])).toBeNull();
  });

  it("wraps a selection that is outside math", () => {
    expect(dollarEdit("abc", 1, 2, [])).toEqual({
      from: 1,
      to: 2,
      insert: "$b$",
      selection: 4,
    });
  });

  it("does not wrap a selection that is inside math", () => {
    expect(dollarEdit("$abc$", 1, 3, [mathSpan(0, 5)])).toBeNull();
  });
});

describe("insert skeletons", () => {
  it("clamps a table to between 1 and 12", () => {
    expect(tableSkeleton(0, Number.NaN)).toBe(
      "#table(\n  columns: (1fr),\n  [],\n)",
    );
    const wide = tableSkeleton(2, 100);
    expect(wide.split("1fr")).toHaveLength(13);
    expect(wide.match(/\[\]/gu)).toHaveLength(24);
  });

  it("builds a fenced block and a math pair", () => {
    expect(codeBlockSkeleton("rust!")).toEqual({
      text: "```rust\n\n```",
      cursor: "```rust\n".length,
    });
    expect(mathSkeleton(false)).toEqual({ text: "$$", cursor: 1 });
    expect(mathSkeleton(true)).toEqual({ text: "$\n  \n$", cursor: 4 });
    expect(mathSkeleton(false, "x")).toEqual({ text: "$x$", cursor: 3 });
  });

  it("selects the url in a link skeleton", () => {
    const link = linkSkeleton("wzór");
    expect(link.text).toBe('#link("https://")[wzór]');
    expect(link.text.slice(link.selectFrom, link.selectTo)).toBe("https://");
  });
});
