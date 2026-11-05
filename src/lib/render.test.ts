import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { byteOffsetToUtf16, debounce, RenderGuard } from "./render";

function byteIndexOf(source: string, needle: string): number {
  const at = source.indexOf(needle);
  return new TextEncoder().encode(source.slice(0, at)).length;
}

describe("byteOffsetToUtf16", () => {
  it("marks the right place after Polish letters", () => {
    const source = "= Łódź ąę\n\n#brak()\n";
    const byteIndex =
      new TextEncoder().encode(source).length -
      new TextEncoder().encode(source.slice(source.indexOf("brak"))).length;
    expect(byteOffsetToUtf16(source, byteIndex)).toBe(source.indexOf("brak"));
  });

  it("clamps places that run past the end", () => {
    expect(byteOffsetToUtf16("abc", 99)).toBe(3);
    expect(byteOffsetToUtf16("abc", -1)).toBe(0);
  });

  // covers: proof 7, a place at the very start and the very end
  it("keeps the start and the end of a source in place", () => {
    const source = "= Cześć\n";
    expect(byteOffsetToUtf16(source, 0)).toBe(0);
    expect(
      byteOffsetToUtf16(source, new TextEncoder().encode(source).length),
    ).toBe(source.length);
  });

  // covers: proof 7, letters that take more than one unit in either count
  it("marks the right place after a picture symbol", () => {
    const source = "a \u{1F600} brak";
    expect(byteOffsetToUtf16(source, byteIndexOf(source, "brak"))).toBe(
      source.indexOf("brak"),
    );
  });

  it("marks the right place in an empty source", () => {
    expect(byteOffsetToUtf16("", 0)).toBe(0);
    expect(byteOffsetToUtf16("", 5)).toBe(0);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // covers: proof 4, typing pauses before a draw is asked for
  it("waits for a pause and then calls once with the last words", () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 350);
    wrapped("a");
    wrapped("ab");
    wrapped("abc");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(349);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("abc");
  });

  it("calls again for a later pause", () => {
    const fn = vi.fn();
    const wrapped = debounce(fn, 100);
    wrapped("one");
    vi.advanceTimersByTime(100);
    wrapped("two");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("two");
  });
});

describe("RenderGuard", () => {
  // covers: proof 4, a late answer for older typing is dropped
  it("only the newest revision counts", () => {
    const guard = new RenderGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("starts at zero and rises by one each time", () => {
    const guard = new RenderGuard();
    expect(guard.latest).toBe(0);
    expect(guard.next()).toBe(1);
    expect(guard.next()).toBe(2);
    expect(guard.latest).toBe(2);
  });
});
