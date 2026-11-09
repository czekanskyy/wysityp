// Theme switch. "system" removes the attribute so tokens.css follows the
// operating system. Storing the choice is left to the settings file in
// Rust (a later `theme` field beside `locale`); this module only applies it.

export type ThemeChoice = "system" | "light" | "dark";

export const theme = {
  apply(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
  },
  current(root: HTMLElement = document.documentElement): ThemeChoice {
    const value = root.dataset.theme;
    return value === "light" || value === "dark" ? value : "system";
  },
};
