export type IconPath = { kind: "path"; d: string };
export type IconCircle = { kind: "circle"; cx: string; cy: string; r: string };
export type IconRect = {
  kind: "rect";
  x: string;
  y: string;
  width: string;
  height: string;
  rx?: string;
};
export type IconPart = IconPath | IconCircle | IconRect;

function path(d: string): IconPath {
  return { kind: "path", d };
}

function circle(cx: string, cy: string, r: string): IconCircle {
  return { kind: "circle", cx, cy, r };
}

function rect(
  x: string,
  y: string,
  width: string,
  height: string,
  rx?: string,
): IconRect {
  return { kind: "rect", x, y, width, height, rx };
}

const sheet = rect("3", "4", "18", "16", "2");

export const icons = {
  // Szukaj
  search: [circle("11", "11", "6.5"), path("m20 20-4.2-4.2")],
  // Kod, also Źródło
  code: [path("m9 8-4 4 4 4"), path("m15 8 4 4-4 4")],
  // Jasny
  light: [
    circle("12", "12", "4"),
    path(
      "M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
    ),
  ],
  // Lista
  bulletList: [
    path("M9 6h11"),
    path("M9 12h11"),
    path("M9 18h11"),
    circle("4.5", "6", ".75"),
    circle("4.5", "12", ".75"),
    circle("4.5", "18", ".75"),
  ],
  // Eksportuj do PDF
  export: [path("M12 4v11"), path("m7 10 5 5 5-5"), path("M5 20h14")],
  // Strona
  page: [
    path("M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"),
    circle("12", "12", "3"),
  ],
  // Podział
  split: [sheet, path("M12 4v16")],
  // Zmień nazwę
  rename: [path("M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"), path("m13.5 6.5 4 4")],
  // Przenieś do
  folder: [
    path(
      "M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z",
    ),
  ],
  // Wzór, Wzór w linii
  inlineMath: [path("M18 5H7l6 7-6 7h11")],
  // Ponów
  redo: [path("m15 14 5-5-5-5"), path("M20 9H9.5a5.5 5.5 0 0 0 0 11H13")],
  // Ustawienia
  settings: [
    circle("12", "12", "3"),
    path(
      "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    ),
  ],
  // disclosure chevron
  chevronDown: [path("m6 9 6 6 6-6")],
  // Usuń
  delete: [
    path("M4 7h16"),
    path("M10 11v6M14 11v6"),
    path("M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"),
    path("M9 7V4h6v3"),
  ],
  // Ciemny
  dark: [path("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z")],
  // Zapisz
  save: [
    path("M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"),
    path("M8 3v5h7V3"),
    path("M8 21v-7h8v7"),
  ],
  // Tabela
  table: [sheet, path("M3 10h18"), path("M3 15h18"), path("M10 4v16")],
  // Cofnij
  undo: [path("M9 14 4 9l5-5"), path("M4 9h10.5a5.5 5.5 0 0 1 0 11H11")],
  // Nowa notatka
  plus: [path("M12 5v14"), path("M5 12h14")],
  // close mark
  close: [path("M6 6l12 12"), path("M18 6 6 18")],
  // Kursywa
  italic: [path("M14 5h-4"), path("M14 19h-4"), path("M14 5 10 19")],
  // Pogrubienie
  bold: [
    path("M7 5h6a3.5 3.5 0 0 1 0 7H7z"),
    path("M7 12h7a3.5 3.5 0 0 1 0 7H7z"),
  ],
  // Więcej
  more: [
    circle("5.5", "12", "1"),
    circle("12", "12", "1"),
    circle("18.5", "12", "1"),
  ],
  // Nagłówek
  heading: [path("M6 5v14"), path("M18 5v14"), path("M6 12h12")],
  // note file
  note: [
    path("M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"),
    path("M14 3v5h5"),
    path("M9 13h6"),
    path("M9 17h4"),
  ],
  // Panel
  panel: [sheet, path("M9 4v16")],
  // Cytat
  quote: [
    path("M4 18h5v-5H5.5C5.5 9.5 7 8 9 7.5"),
    path("M14 18h5v-5h-3.5c0-3.5 1.5-5 3.5-5.5"),
  ],
  // Obraz
  image: [sheet, circle("9", "10", "1.75"), path("m21 16-5-5-9 9")],
  // disclosure chevron, right
  chevronRight: [path("m9 6 6 6-6 6")],
  // Odnośnik
  link: [
    path("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"),
    path("M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  ],
  // Otwórz folder
  openFolder: [
    path("M3 17V7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h6A2.5 2.5 0 0 1 19.5 10v.5"),
    path(
      "M3 17l2.4-5.6A2 2 0 0 1 7.2 10.2H20a1 1 0 0 1 .9 1.4L18.6 17.8A2 2 0 0 1 16.8 19H5a2 2 0 0 1-2-2z",
    ),
  ],
  // Wzór blokowy
  blockMath: [sheet, path("M15 8H9l3.5 4L9 16h6")],
  // Przekreślenie
  strike: [
    path("M5 12h14"),
    path("M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.3-4 3 0 1 .5 1.8 1.5 2.4"),
    path("M8 17a4 3 0 0 0 4 2c2.5 0 4-1.3 4-3"),
  ],
  // Lista numerowana
  numberedList: [
    path("M10 6h10"),
    path("M10 12h10"),
    path("M10 18h10"),
    path("M4 5l1.5-1v5"),
    path("M3.5 14.5a1.5 1.5 0 1 1 2.6 1L3.5 19H6.5"),
  ],
  // warning mark
  warning: [
    path(
      "M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z",
    ),
    path("M12 9.5v4"),
    circle("12", "17", ".5"),
  ],
} as const satisfies Record<string, readonly IconPart[]>;

export type IconId = keyof typeof icons;
