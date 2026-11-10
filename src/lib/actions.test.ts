import { describe, expect, it } from "vitest";

import {
  ACTION_SPECS,
  folderNotes,
  formatOf,
  goToItems,
  paletteCommands,
  shortcutRows,
  windowActionId,
  type ActionGroup,
  type LabelKey,
} from "./actions";
import { fuzzyScore, rankByFuzzy } from "./ui/fold";
import { formatShortcut } from "./toolbarActions";

const key = (
  extra: Partial<{
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  }>,
) => ({
  key: "",
  code: "",
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});

describe("action registry", () => {
  it("gives every real action one id and keeps editor chords off the window", () => {
    const ids = ACTION_SPECS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(windowActionId(key({ ctrlKey: true, code: "KeyB", key: "b" }))).toBe(
      null,
    );
    expect(
      windowActionId(
        key({ ctrlKey: true, altKey: true, code: "Digit1", key: "1" }),
      ),
    ).toBe(null);
    expect(windowActionId(key({ key: "F1", code: "F1" }))).toBe("show-palette");
    expect(
      windowActionId(
        key({ ctrlKey: true, shiftKey: true, code: "KeyP", key: "P" }),
      ),
    ).toBe("show-palette");
    expect(windowActionId(key({ ctrlKey: true, code: "KeyP", key: "p" }))).toBe(
      "go-to-note",
    );
    expect(
      windowActionId(key({ ctrlKey: true, code: "Slash", key: "/" })),
    ).toBe("show-shortcuts");
    expect(
      windowActionId(key({ ctrlKey: true, shiftKey: true, key: "/" })),
    ).toBe("show-shortcuts");
    expect(
      windowActionId(key({ ctrlKey: true, code: "Backslash", key: "\\" })),
    ).toBe("toggle-sidebar");
  });

  it("puts the same shortcuts on the sheet and the formatting toolbar", () => {
    const rows = shortcutRows();
    expect(rows.some((row) => row.shortcut.join("+") === "F1")).toBe(true);
    expect(rows.some((row) => row.shortcut.join("+") === "Ctrl+Shift+P")).toBe(
      true,
    );
    for (const spec of ACTION_SPECS) {
      if (!spec.format) continue;
      expect(spec.shortcut).toEqual(formatShortcut[spec.format]);
      expect(formatOf(spec.id)).toBe(spec.format);
    }
    const labels = Object.fromEntries(
      ACTION_SPECS.map((spec) => [spec.labelKey, spec.labelKey]),
    ) as Record<LabelKey, string>;
    const groups = {
      file: "File",
      edit: "Edit",
      view: "View",
      format: "Format",
      settings: "Settings",
    } as Record<ActionGroup, string>;
    const commands = paletteCommands(labels, groups);
    expect(commands.some((command) => command.id === "show-palette")).toBe(
      false,
    );
    expect(commands.some((command) => command.id === "format:bold")).toBe(true);
    expect(commands.map((command) => command.id)).not.toContain(
      "format:missing",
    );
  });
});

describe("fuzzy filter", () => {
  it("folds Polish and ranks a prefix above a subsequence", () => {
    expect(fuzzyScore("Całka", "calka")).toBeGreaterThan(0);
    expect(fuzzyScore("Pogrubienie", "pog")).toBeGreaterThan(
      fuzzyScore("Pogrubienie", "prg"),
    );
    expect(fuzzyScore("Notatka", "xyz")).toBe(0);
    const ranked = rankByFuzzy(
      ["Nowa notatka", "Otwórz notatkę", "Pogrubienie"],
      "not",
      (label) => label,
    );
    expect(ranked[0]).toBe("Nowa notatka");
    expect(ranked).toContain("Otwórz notatkę");
    expect(ranked).not.toContain("Pogrubienie");
  });

  it("keeps the registry order when the query is empty", () => {
    const labels = ["Zapisz", "Otwórz", "Zamknij"];
    expect(rankByFuzzy(labels, "  ", (label) => label)).toEqual(labels);
  });
});

describe("go to note", () => {
  it("lists open tabs, then recents and folder notes that are not already open", () => {
    const items = goToItems(
      [{ id: 4, title: "Wykład", key: "C:/Notes/week/a.typ" }],
      ["C:/Notes/week/a.typ", "C:/Desk/loose.typ"],
      folderNotes([
        {
          kind: "folder",
          path: "week",
          name: "week",
          children: [
            { kind: "note", path: "week/a.typ", name: "a.typ", children: [] },
          ],
        },
        { kind: "note", path: "b.typ", name: "b.typ", children: [] },
      ]),
      { tabs: "Open", recent: "Recent", folder: "Folder" },
    );
    expect(items.map((item) => item.label)).toEqual([
      "Wykład",
      "loose.typ",
      "b.typ",
    ]);
    expect(items.map((item) => item.group)).toEqual([
      "Open",
      "Recent",
      "Folder",
    ]);
    expect(items[1]?.id).toBe(
      `path:${encodeURIComponent("C:/Desk/loose.typ")}`,
    );
  });
});
