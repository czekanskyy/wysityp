import type { IconId } from "./icons";

export type MenuItem = {
  separator?: false;
  label: string;
  onclick: () => void;
  icon?: IconId;
  shortcut?: readonly string[];
  danger?: boolean;
  disabled?: boolean;
};

export type MenuSeparator = {
  separator: true;
};

export type MenuEntry = MenuItem | MenuSeparator;

export type SegmentOption = {
  value: string;
  label: string;
  icon?: IconId;
  iconOnly?: boolean;
};

export type SegmentOptions =
  | readonly [SegmentOption, SegmentOption]
  | readonly [SegmentOption, SegmentOption, SegmentOption]
  | readonly [SegmentOption, SegmentOption, SegmentOption, SegmentOption];

export type TagColor =
  "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

export type NotePageColor = "white" | "beige" | "graphite" | "oled";

export type CommandItem = {
  id: string;
  label: string;
  icon?: IconId;
  shortcut?: readonly string[];
  group?: string;
};

export type SidebarSection = {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
};

export type SidebarItem = {
  id: string;
  sectionId: string;
  label: string;
  level: number;
  kind: "folder" | "note";
  expanded?: boolean;
  selected?: boolean;
  unsaved?: boolean;
};

export type SidebarFooterEntry = {
  label: string;
  onclick: () => void;
};

export type ToolbarItem = {
  id: string;
  label: string;
  icon: IconId;
  pressed?: boolean;
  disabled?: boolean;
};
