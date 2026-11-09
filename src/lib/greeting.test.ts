import { describe, expect, it } from "vitest";
import { formatNoteDate, greetingIndex } from "./greeting";

describe("greeting day index", () => {
  it("gives 1 January index 0", () => {
    expect(greetingIndex(new Date(2026, 0, 1, 23, 30))).toBe(0);
    expect(greetingIndex(new Date(2026, 0, 2, 0, 30))).toBe(1);
    expect(greetingIndex(new Date(2026, 0, 8, 12))).toBe(0);
  });

  it("counts 29 February and ignores a daylight saving shift", () => {
    expect(greetingIndex(new Date(2024, 1, 29, 12))).toBe(59 % 7);
    const before = new Date(2026, 2, 7, 12);
    const after = new Date(2026, 2, 8, 12);
    expect(greetingIndex(after)).toBe((greetingIndex(before) + 1) % 7);
  });

  it("keeps the same index for the whole local day", () => {
    const morning = greetingIndex(new Date(2026, 5, 15, 0, 30));
    const evening = greetingIndex(new Date(2026, 5, 15, 23, 30));
    expect(evening).toBe(morning);
  });

  it("formats the date in the active language", () => {
    const date = new Date(2026, 0, 5, 12);
    expect(formatNoteDate(date, "en")).toMatch(/January/);
    expect(formatNoteDate(date, "en")).toMatch(/Monday/);
    expect(formatNoteDate(date, "pl")).toMatch(/stycznia|styczeń/i);
  });
});
