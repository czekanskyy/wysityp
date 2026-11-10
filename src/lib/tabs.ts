import {
  EDITOR_PLACE_START,
  type EditorPlace,
  type SavePhase,
} from "./noteSafety";

export type TabKind = "note" | "draft" | "template";

export type TabModel = {
  id: number;
  kind: TabKind;
  key: string;
  title: string;
  dirty: boolean;
  text: string;
  place: EditorPlace;
  revision: number;
  epoch: number;
  savePhase: SavePhase;
  conflict: boolean;
  reloadArmed: boolean;
  saveFailed: boolean;
};

export function fileName(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut === -1 ? path : path.slice(cut + 1);
}

export function tabTitle(kind: TabKind, key: string, untitled: string): string {
  if (kind === "draft") return untitled;
  return fileName(key);
}

export function createTab(
  id: number,
  kind: TabKind,
  key: string,
  text: string,
  untitled: string,
): TabModel {
  return {
    id,
    kind,
    key,
    title: tabTitle(kind, key, untitled),
    dirty: false,
    text,
    place: { ...EDITOR_PLACE_START },
    revision: 0,
    epoch: 1,
    savePhase: "saved",
    conflict: false,
    reloadArmed: false,
    saveFailed: false,
  };
}

export function findTabByKey(
  tabs: readonly Pick<TabModel, "kind" | "key">[],
  kind: TabKind,
  key: string,
): number {
  return tabs.findIndex(
    (tab) => tab.kind === kind && tab.key.toLowerCase() === key.toLowerCase(),
  );
}

export function cycleIndex(
  length: number,
  index: number,
  backward: boolean,
): number {
  if (length <= 0) return -1;
  const current = index < 0 ? 0 : index;
  const step = backward ? -1 : 1;
  return (current + step + length) % length;
}

export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...items];
  next.splice(to, 0, item);
  return next;
}

export function retargetKey(key: string, from: string, to: string): string {
  if (key.toLowerCase() === from.toLowerCase()) return to;
  const prefix = `${from}/`;
  if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
    return to + key.slice(from.length);
  }
  return key;
}

export function keyWasRemoved(key: string, removed: string): boolean {
  const path = key.toLowerCase();
  const target = removed.toLowerCase();
  return path === target || path.startsWith(`${target}/`);
}

export function sessionToken(tab: Pick<TabModel, "kind" | "key">): string {
  return tab.kind === "template" ? `template:${tab.key}` : tab.key;
}

export function neighborIndex(length: number, index: number): number {
  if (length <= 1) return -1;
  return index >= length - 1 ? index - 1 : index;
}

/** A workspace-relative key and the absolute path of the same note. */
export function pathsMatch(a: string, b: string): boolean {
  const left = a.replaceAll("\\", "/").toLowerCase();
  const right = b.replaceAll("\\", "/").toLowerCase();
  if (left === right) return true;
  const relative = left.includes(":") || left.startsWith("/") ? right : left;
  const absolute = relative === left ? right : left;
  if (relative.includes(":") || relative.startsWith("/")) return false;
  return absolute.endsWith(`/${relative}`);
}
