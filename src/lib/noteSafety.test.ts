import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTOSAVE_WAIT_MS,
  createAutosaveTimer,
  isExternalChange,
  openIdentityPath,
  savedTextIsCurrent,
  shouldApplySaveResult,
  shouldRunSave,
  showsRendered,
  showsSource,
  type OpenNote,
  type SaveTicket,
} from "./noteSafety";

const open: OpenNote = { id: 1, path: "notes/one.typ", revision: 3 };

function ticket(over: Partial<SaveTicket> = {}): SaveTicket {
  return { id: 1, path: "notes/one.typ", revision: 3, text: "one\n", ...over };
}

describe("note views", () => {
  it("shows source, the page, or both", () => {
    expect(showsSource("source")).toBe(true);
    expect(showsRendered("source")).toBe(false);
    expect(showsSource("rendered")).toBe(false);
    expect(showsRendered("rendered")).toBe(true);
    expect(showsSource("split")).toBe(true);
    expect(showsRendered("split")).toBe(true);
  });
});

describe("openIdentityPath", () => {
  // covers: spec 0006 AC-8, a template save must pass the same check as a note save
  it("names an open template the same way for the open item and its ticket", () => {
    const path = openIdentityPath("", "alpha.typ");
    expect(path).toBe("template:alpha.typ");
    const templateOpen: OpenNote = { id: 4, path, revision: 2 };
    const templateTicket = ticket({
      id: 4,
      path: openIdentityPath("", "alpha.typ"),
      revision: 2,
    });
    for (const origin of ["auto", "manual", "force"] as const) {
      expect(
        shouldRunSave(templateOpen, templateTicket, false, "unsaved", origin),
      ).toBe(true);
    }
  });

  it("uses the note path when no template is open", () => {
    expect(openIdentityPath("notes/one.typ", "")).toBe("notes/one.typ");
  });
});

describe("shouldRunSave", () => {
  // covers: feature 9, a stale autosave must not write the note that is open now
  it("refuses a ticket for a note that is no longer open", () => {
    expect(
      shouldRunSave(
        open,
        ticket({ id: 2, path: "notes/two.typ" }),
        false,
        "unsaved",
        "auto",
      ),
    ).toBe(false);
    expect(
      shouldRunSave(
        open,
        ticket({ path: "notes/two.typ" }),
        false,
        "unsaved",
        "force",
      ),
    ).toBe(false);
    expect(shouldRunSave(null, ticket(), false, "unsaved", "manual")).toBe(
      false,
    );
  });

  it("lets autosave run only for the current unsaved revision, and pauses it on a conflict", () => {
    expect(shouldRunSave(open, ticket(), false, "unsaved", "auto")).toBe(true);
    expect(shouldRunSave(open, ticket(), false, "saved", "auto")).toBe(false);
    expect(shouldRunSave(open, ticket(), true, "unsaved", "auto")).toBe(false);
    expect(
      shouldRunSave(open, ticket({ revision: 2 }), false, "unsaved", "auto"),
    ).toBe(false);
  });

  it("keeps a manual save and an explicit overwrite", () => {
    expect(shouldRunSave(open, ticket(), true, "unsaved", "manual")).toBe(true);
    expect(shouldRunSave(open, ticket(), false, "saved", "manual")).toBe(true);
    expect(shouldRunSave(open, ticket(), true, "unsaved", "force")).toBe(true);
    expect(
      shouldRunSave(open, ticket({ revision: 1 }), true, "unsaved", "manual"),
    ).toBe(false);
  });
});

describe("save results", () => {
  it("drops a result from an older request or another note", () => {
    expect(shouldApplySaveResult(open, ticket(), 2, 2)).toBe(true);
    expect(shouldApplySaveResult(open, ticket(), 1, 2)).toBe(false);
    expect(shouldApplySaveResult(open, ticket({ id: 9 }), 2, 2)).toBe(false);
    expect(shouldApplySaveResult(null, ticket(), 1, 1)).toBe(false);
  });

  it("treats the buffer as caught up only when the saved revision is still current", () => {
    expect(savedTextIsCurrent(open, ticket(), "one\n")).toBe(true);
    expect(savedTextIsCurrent(open, ticket(), "one\nmore")).toBe(false);
    expect(
      savedTextIsCurrent({ ...open, revision: 4 }, ticket(), "one\n"),
    ).toBe(false);
  });

  it("recognises the Rust conflict error and nothing else", () => {
    expect(
      isExternalChange(
        new Error(
          "external-change: the note on disk was changed by another tool",
        ),
      ),
    ).toBe(true);
    expect(isExternalChange("external-change: gone")).toBe(true);
    expect(isExternalChange(new Error("saving failed"))).toBe(false);
    expect(isExternalChange(new Error("see external-change later"))).toBe(
      false,
    );
  });
});

describe("createAutosaveTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // covers: feature 9, autosave waits for a pause and keeps only the latest ticket
  it("fires once with the latest ticket after the pause", () => {
    const timer = createAutosaveTimer(AUTOSAVE_WAIT_MS);
    const run = vi.fn();
    timer.schedule(ticket({ text: "a", revision: 1 }), run);
    timer.schedule(ticket({ text: "ab", revision: 2 }), run);
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(ticket({ text: "ab", revision: 2 }));
  });

  it("cancel drops a pending save", () => {
    const timer = createAutosaveTimer(AUTOSAVE_WAIT_MS);
    const run = vi.fn();
    timer.schedule(ticket(), run);
    timer.cancel();
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MS);
    expect(run).not.toHaveBeenCalled();
  });
});
