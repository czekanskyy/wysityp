import { m } from "../paraglide/messages.js";
import type { ActionGroup, LabelKey } from "./actions";

export type ActionCopy = {
  labels: Record<LabelKey, string>;
  groups: Record<ActionGroup, string>;
  goGroups: { tabs: string; recent: string; folder: string };
  palette: {
    label: string;
    placeholder: string;
    empty: string;
    hints: string[];
  };
  go: { label: string; placeholder: string; empty: string };
  sheet: { label: string; placeholder: string; empty: string; close: string };
};

export function actionCopy(): ActionCopy {
  const labels: Record<LabelKey, string> = {
    new_note: m.new_note(),
    open_note: m.open_note(),
    open_folder: m.open_folder(),
    save_note: m.save_note(),
    save_as: m.save_as(),
    tab_close: m.tab_close(),
    export_pdf: m.export_pdf(),
    undo: m.undo(),
    redo: m.redo(),
    next_tab: m.next_tab(),
    previous_tab: m.previous_tab(),
    toggle_sidebar: m.toggle_sidebar(),
    view_page: m.view_page(),
    view_source_mode: m.view_source_mode(),
    view_split_mode: m.view_split_mode(),
    search_label: m.search_label(),
    show_shortcuts: m.show_shortcuts(),
    palette_label: m.palette_label(),
    go_note_label: m.go_note_label(),
    bold: m.bold(),
    italic: m.italic(),
    underline: m.underline(),
    strike: m.strike(),
    inline_code: m.inline_code(),
    bullet_list: m.bullet_list(),
    numbered_list: m.numbered_list(),
    quote: m.quote(),
    inline_math: m.inline_math(),
    block_math: m.block_math(),
    code_block: m.code_block(),
    insert_link: m.insert_link(),
    insert_table: m.insert_table(),
    body_text: m.body_text(),
    heading_1: m.heading_1(),
    heading_2: m.heading_2(),
    heading_3: m.heading_3(),
    appearance_label: m.appearance_label(),
    theme_system: m.theme_system(),
    theme_light: m.theme_light(),
    theme_dark: m.theme_dark(),
    page_white: m.page_white(),
    page_beige: m.page_beige(),
    page_graphite: m.page_graphite(),
    page_oled: m.page_oled(),
    language_pl: m.language_pl(),
    language_en: m.language_en(),
  };
  return {
    labels,
    groups: {
      file: m.group_file(),
      edit: m.group_edit(),
      view: m.group_view(),
      format: m.group_format(),
      settings: m.group_settings(),
    },
    goGroups: {
      tabs: m.group_open_tabs(),
      recent: m.welcome_recent(),
      folder: m.notes_in_folder(),
    },
    palette: {
      label: m.palette_label(),
      placeholder: m.palette_placeholder(),
      empty: m.palette_empty(),
      hints: [
        m.palette_hint_move(),
        m.palette_hint_run(),
        m.palette_hint_close(),
      ],
    },
    go: {
      label: m.go_note_label(),
      placeholder: m.go_note_placeholder(),
      empty: m.go_note_empty(),
    },
    sheet: {
      label: m.show_shortcuts(),
      placeholder: m.shortcut_search(),
      empty: m.shortcut_empty(),
      close: m.appearance_close(),
    },
  };
}
