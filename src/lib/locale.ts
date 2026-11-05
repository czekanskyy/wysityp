import {
  defineCustomClientStrategy,
  setLocale as paraglideSetLocale,
} from "../paraglide/runtime.js";

export type AppLocale = "pl" | "en";

let current: AppLocale = "pl";
let defined = false;

/**
 * The settings file in Rust is the only place the chosen language
 * lives. This module only keeps the value in memory for Paraglide,
 * after Rust has read it from that file. Nothing is written here.
 */
export function initLocale(locale: string): AppLocale {
  current = locale === "en" ? "en" : "pl";
  if (!defined) {
    defined = true;
    defineCustomClientStrategy("custom-settings", {
      getLocale: () => current,
      setLocale: (next) => {
        current = next === "en" ? "en" : "pl";
      },
    });
  }
  paraglideSetLocale(current, { reload: false });
  document.documentElement.lang = current;
  return current;
}

export function applyLocale(locale: AppLocale): void {
  current = locale;
  paraglideSetLocale(locale, { reload: false });
  document.documentElement.lang = locale;
}

export function currentLocale(): AppLocale {
  return current;
}
