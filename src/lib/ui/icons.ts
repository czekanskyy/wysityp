// A small, offline icon set: 24px grid, 1.75 stroke, round caps.
// Drawn for WYSITyp in the style of common open icon sets. Each entry is
// the inner SVG markup. Add icons here instead of pulling a package.

export const icons = {
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M14 5h-4"/><path d="M14 19h-4"/><path d="M14 5 10 19"/>',
  underline: '<path d="M7 5v6a5 5 0 0 0 10 0V5"/><path d="M5 20h14"/>',
  strike:
    '<path d="M5 12h14"/><path d="M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.3-4 3 0 1 .5 1.8 1.5 2.4"/><path d="M8 17a4 3 0 0 0 4 2c2.5 0 4-1.3 4-3"/>',
  heading: '<path d="M6 5v14"/><path d="M18 5v14"/><path d="M6 12h12"/>',
  list: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="4.5" cy="6" r=".75"/><circle cx="4.5" cy="12" r=".75"/><circle cx="4.5" cy="18" r=".75"/>',
  listOrdered:
    '<path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 5l1.5-1v5"/><path d="M3.5 14.5a1.5 1.5 0 1 1 2.6 1L3.5 19H6.5"/>',
  quote:
    '<path d="M4 18h5v-5H5.5C5.5 9.5 7 8 9 7.5"/><path d="M14 18h5v-5h-3.5c0-3.5 1.5-5 3.5-5.5"/>',
  math: '<path d="M18 5H7l6 7-6 7h11"/>',
  mathBlock:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 8H9l3.5 4L9 16h6"/>',
  code: '<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.75"/><path d="m21 16-5-5-9 9"/>',
  table:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M3 15h18"/><path d="M10 4v16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  folder:
    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/>',
  folderOpen:
    '<path d="M3 17V7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h6A2.5 2.5 0 0 1 19.5 10v.5"/><path d="M3 17l2.4-5.6A2 2 0 0 1 7.2 10.2H20a1 1 0 0 1 .9 1.4L18.6 17.8A2 2 0 0 1 16.8 19H5a2 2 0 0 1-2-2z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  fileText:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  command:
    '<path d="M9 6v12M15 6v12M6 9h12M6 15h12"/><path d="M9 9H7.5A1.5 1.5 0 1 1 9 7.5zM15 9h1.5A1.5 1.5 0 1 0 15 7.5zM9 15H7.5A1.5 1.5 0 1 0 9 16.5zM15 15h1.5a1.5 1.5 0 1 1-1.5 1.5z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  template:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3"/><path d="M8 21v-7h8v7"/>',
  trash:
    '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/>',
  pencil:
    '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  columns:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  sidebar:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="8" cy="8" r="1.25"/>',
  alert:
    '<path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><circle cx="12" cy="17" r=".5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
} as const;

export type IconName = keyof typeof icons;
