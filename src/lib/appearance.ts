import type { NotePageColor } from "./ui/types";

export type AppTheme = "system" | "light" | "dark";

export type StartupAppearance = {
  theme: AppTheme;
  pageColor: NotePageColor;
  error: string;
};

export function applyDocumentTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
    return;
  }
  delete root.dataset.theme;
}

export function asTheme(value: string): AppTheme {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function asPageColor(value: string): NotePageColor {
  if (
    value === "white" ||
    value === "beige" ||
    value === "graphite" ||
    value === "oled"
  ) {
    return value;
  }
  return "white";
}
