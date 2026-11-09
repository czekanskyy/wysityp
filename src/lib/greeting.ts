import type { AppLocale } from "./locale";

// Count local calendar days from 1 January. UTC date parts keep a daylight
// saving change from moving the index. 1 January is 0.
export function greetingIndex(date: Date): number {
  const year = date.getFullYear();
  const start = Date.UTC(year, 0, 1);
  const today = Date.UTC(year, date.getMonth(), date.getDate());
  const days = Math.round((today - start) / 86_400_000);
  return ((days % 7) + 7) % 7;
}

export function formatNoteDate(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function localDateStamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
