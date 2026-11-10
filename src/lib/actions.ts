/** One list of real actions. The palette and the shortcut sheet both read it. */

import { fileName, pathsMatch } from "./tabs";
import type { FormatAction } from "./toolbarActions";
import { formatShortcut } from "./toolbarActions";
import type { IconId } from "./ui/icons";
import type { CommandItem } from "./ui/types";

export type ActionGroup = "file" | "edit" | "view" | "format" | "settings";

export type LabelKey =
  | "new_note"
  | "open_note"
  | "open_folder"
  | "save_note"
  | "save_as"
  | "tab_close"
  | "export_pdf"
  | "undo"
  | "redo"
  | "next_tab"
  | "previous_tab"
  | "toggle_sidebar"
  | "view_page"
  | "view_source_mode"
  | "view_split_mode"
  | "search_label"
  | "show_shortcuts"
  | "palette_label"
  | "go_note_label"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "inline_code"
  | "bullet_list"
  | "numbered_list"
  | "quote"
  | "inline_math"
  | "block_math"
  | "code_block"
  | "insert_link"
  | "insert_table"
  | "body_text"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "appearance_label"
  | "theme_system"
  | "theme_light"
  | "theme_dark"
  | "page_white"
  | "page_beige"
  | "page_graphite"
  | "page_oled"
  | "language_pl"
  | "language_en";

type Chord = { code: string; shift?: boolean };

export type ActionSpec = {
  id: string;
  labelKey: LabelKey;
  group: ActionGroup;
  icon?: IconId;
  shortcut?: readonly string[];
  /** A second way to press the same action, shown on the sheet. */
  extraShortcut?: readonly string[];
  /** On the sheet, not in the command list. */
  sheetOnly?: boolean;
  /** The editor keymap owns this chord. The window must leave it alone. */
  editor?: boolean;
  chord?: Chord;
  format?: FormatAction;
  mark?: string;
};

const formatSpec = (
  action: FormatAction,
  labelKey: LabelKey,
  icon: IconId,
  mark: string,
): ActionSpec => ({
  id: `format:${action}`,
  labelKey,
  group: "format",
  icon,
  shortcut: formatShortcut[action],
  editor: formatShortcut[action] !== undefined,
  format: action,
  mark,
});

export const ACTION_SPECS: readonly ActionSpec[] = [
  {
    id: "new-note",
    labelKey: "new_note",
    group: "file",
    icon: "plus",
    shortcut: ["Ctrl", "N"],
    chord: { code: "KeyN" },
  },
  {
    id: "open-note",
    labelKey: "open_note",
    group: "file",
    icon: "note",
    shortcut: ["Ctrl", "O"],
    chord: { code: "KeyO" },
  },
  {
    id: "open-folder",
    labelKey: "open_folder",
    group: "file",
    icon: "openFolder",
    shortcut: ["Ctrl", "Shift", "O"],
    chord: { code: "KeyO", shift: true },
  },
  {
    id: "save",
    labelKey: "save_note",
    group: "file",
    icon: "save",
    shortcut: ["Ctrl", "S"],
    chord: { code: "KeyS" },
  },
  {
    id: "save-as",
    labelKey: "save_as",
    group: "file",
    icon: "save",
    shortcut: ["Ctrl", "Shift", "S"],
    chord: { code: "KeyS", shift: true },
  },
  {
    id: "close-tab",
    labelKey: "tab_close",
    group: "file",
    icon: "close",
    shortcut: ["Ctrl", "W"],
    chord: { code: "KeyW" },
  },
  {
    id: "export-pdf",
    labelKey: "export_pdf",
    group: "file",
    icon: "export",
  },
  {
    id: "undo",
    labelKey: "undo",
    group: "edit",
    icon: "undo",
    shortcut: ["Ctrl", "Z"],
    editor: true,
  },
  {
    id: "redo",
    labelKey: "redo",
    group: "edit",
    icon: "redo",
    shortcut: ["Ctrl", "Y"],
    editor: true,
  },
  {
    id: "next-tab",
    labelKey: "next_tab",
    group: "view",
    icon: "chevronRight",
    shortcut: ["Ctrl", "Tab"],
    chord: { code: "Tab" },
  },
  {
    id: "previous-tab",
    labelKey: "previous_tab",
    group: "view",
    icon: "chevronDown",
    shortcut: ["Ctrl", "Shift", "Tab"],
    chord: { code: "Tab", shift: true },
  },
  {
    id: "toggle-sidebar",
    labelKey: "toggle_sidebar",
    group: "view",
    icon: "panel",
    shortcut: ["Ctrl", "\\"],
    chord: { code: "Backslash" },
  },
  {
    id: "view-page",
    labelKey: "view_page",
    group: "view",
    icon: "page",
  },
  {
    id: "view-source",
    labelKey: "view_source_mode",
    group: "view",
    icon: "code",
  },
  {
    id: "view-split",
    labelKey: "view_split_mode",
    group: "view",
    icon: "split",
  },
  {
    id: "search-notes",
    labelKey: "search_label",
    group: "view",
    icon: "search",
  },
  {
    id: "go-to-note",
    labelKey: "go_note_label",
    group: "view",
    icon: "note",
    shortcut: ["Ctrl", "P"],
    chord: { code: "KeyP" },
  },
  {
    id: "show-palette",
    labelKey: "palette_label",
    group: "view",
    icon: "search",
    shortcut: ["Ctrl", "Shift", "P"],
    extraShortcut: ["F1"],
    sheetOnly: true,
    chord: { code: "KeyP", shift: true },
  },
  {
    id: "show-shortcuts",
    labelKey: "show_shortcuts",
    group: "view",
    icon: "settings",
    shortcut: ["Ctrl", "/"],
    chord: { code: "Slash" },
  },
  formatSpec("bold", "bold", "bold", "*…*"),
  formatSpec("italic", "italic", "italic", "_…_"),
  formatSpec("underline", "underline", "underline", "#underline[…]"),
  formatSpec("strike", "strike", "strike", "#strike[…]"),
  formatSpec("code", "inline_code", "code", "`…`"),
  formatSpec("bullet", "bullet_list", "bulletList", "- "),
  formatSpec("numbered", "numbered_list", "numberedList", "+ "),
  formatSpec("quote", "quote", "quote", "#quote[…]"),
  formatSpec("heading-0", "body_text", "heading", ""),
  formatSpec("heading-1", "heading_1", "heading", "= "),
  formatSpec("heading-2", "heading_2", "heading", "== "),
  formatSpec("heading-3", "heading_3", "heading", "=== "),
  formatSpec("math-inline", "inline_math", "inlineMath", "$…$"),
  formatSpec("math-block", "block_math", "blockMath", "$ … $"),
  formatSpec("code-block", "code_block", "codeBlock", "```"),
  formatSpec("link", "insert_link", "link", "#link(…)"),
  formatSpec("table", "insert_table", "table", "#table"),
  {
    id: "appearance",
    labelKey: "appearance_label",
    group: "settings",
    icon: "settings",
  },
  {
    id: "theme-system",
    labelKey: "theme_system",
    group: "settings",
    icon: "settings",
  },
  {
    id: "theme-light",
    labelKey: "theme_light",
    group: "settings",
    icon: "light",
  },
  {
    id: "theme-dark",
    labelKey: "theme_dark",
    group: "settings",
    icon: "dark",
  },
  {
    id: "page-white",
    labelKey: "page_white",
    group: "settings",
    icon: "page",
  },
  {
    id: "page-beige",
    labelKey: "page_beige",
    group: "settings",
    icon: "page",
  },
  {
    id: "page-graphite",
    labelKey: "page_graphite",
    group: "settings",
    icon: "page",
  },
  {
    id: "page-oled",
    labelKey: "page_oled",
    group: "settings",
    icon: "page",
  },
  {
    id: "language-pl",
    labelKey: "language_pl",
    group: "settings",
    icon: "settings",
  },
  {
    id: "language-en",
    labelKey: "language_en",
    group: "settings",
    icon: "settings",
  },
];

export type KeySnapshot = {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export function windowActionId(event: KeySnapshot): string | null {
  if (event.metaKey || event.altKey) return null;
  if (event.key === "F1" && !event.ctrlKey && !event.shiftKey) {
    return "show-palette";
  }
  if (
    event.ctrlKey &&
    (event.key === "/" || (event.code === "Slash" && !event.shiftKey))
  ) {
    return "show-shortcuts";
  }
  if (!event.ctrlKey) return null;
  for (const spec of ACTION_SPECS) {
    const chord = spec.chord;
    if (!chord || spec.editor) continue;
    if (Boolean(chord.shift) !== event.shiftKey) continue;
    if (chord.code === event.code) return spec.id;
  }
  return null;
}

export function formatOf(id: string): FormatAction | null {
  return ACTION_SPECS.find((spec) => spec.id === id)?.format ?? null;
}

export function paletteCommands(
  labels: Record<LabelKey, string>,
  groups: Record<ActionGroup, string>,
): CommandItem[] {
  return ACTION_SPECS.filter((spec) => !spec.sheetOnly).map((spec) => ({
    id: spec.id,
    label: labels[spec.labelKey],
    icon: spec.icon,
    shortcut: spec.shortcut,
    group: groups[spec.group],
  }));
}

export type ShortcutRow = {
  id: string;
  labelKey: LabelKey;
  group: ActionGroup;
  shortcut: readonly string[];
  mark?: string;
};

export function shortcutRows(): ShortcutRow[] {
  const rows: ShortcutRow[] = [];
  for (const spec of ACTION_SPECS) {
    if (spec.shortcut) {
      rows.push({
        id: spec.id,
        labelKey: spec.labelKey,
        group: spec.group,
        shortcut: spec.shortcut,
        mark: spec.mark,
      });
    }
    if (spec.extraShortcut) {
      rows.push({
        id: `${spec.id}:extra`,
        labelKey: spec.labelKey,
        group: spec.group,
        shortcut: spec.extraShortcut,
        mark: spec.mark,
      });
    }
  }
  return rows;
}

export type NoteNode = {
  kind: string;
  path: string;
  name: string;
  children?: readonly NoteNode[];
};

export function folderNotes(
  nodes: readonly NoteNode[],
): { path: string; name: string }[] {
  const notes: { path: string; name: string }[] = [];
  const walk = (list: readonly NoteNode[]) => {
    for (const node of list) {
      if (node.kind === "note")
        notes.push({ path: node.path, name: node.name });
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return notes;
}

export function goToItems(
  tabs: readonly { id: number; title: string; key: string }[],
  recents: readonly string[],
  notes: readonly { path: string; name: string }[],
  groups: { tabs: string; recent: string; folder: string },
): CommandItem[] {
  const items: CommandItem[] = [];
  const seen = new Set<string>();
  const remember = (path: string) => {
    if (!path) return;
    seen.add(path.replaceAll("\\", "/").toLowerCase());
  };
  const covered = (path: string) => {
    const folded = path.replaceAll("\\", "/").toLowerCase();
    if (seen.has(folded)) return true;
    return tabs.some((tab) => tab.key !== "" && pathsMatch(tab.key, path));
  };

  for (const tab of tabs) {
    items.push({
      id: `tab:${tab.id}`,
      label: tab.title,
      icon: "note",
      group: groups.tabs,
    });
    remember(tab.key);
  }
  for (const path of recents) {
    if (covered(path)) continue;
    remember(path);
    items.push({
      id: `path:${encodeURIComponent(path)}`,
      label: fileName(path),
      icon: "note",
      group: groups.recent,
    });
  }
  for (const note of notes) {
    if (covered(note.path)) continue;
    remember(note.path);
    items.push({
      id: `path:${encodeURIComponent(note.path)}`,
      label: note.name || fileName(note.path),
      icon: "page",
      group: groups.folder,
    });
  }
  return items;
}
