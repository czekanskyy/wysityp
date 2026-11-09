# Toolbar

Pasek formatowania nad notatką, z obszarem `end` na przełącznik widoku.

Kolejność grup (oddzielonych `ToolbarSeparator`): cofnij, ponów | nagłówek, pogrubienie, kursywa, przekreślenie | listy, cytat | wzór w linii, wzór blokowy, kod, odnośnik, tabela, obraz | na końcu `SegmentedControl` widoku (źródło, podział, strona).

- `role="toolbar"` z etykietą; jedno miejsce w kolejności Tab, strzałki Lewo/Prawo, Home i End przechodzą między przyciskami.
- Przyciski to `IconButton` w rozmiarze `sm`; przełączniki stylu mają `pressed`.
- Tło `color-surface`, dolna linia `color-border`.

Kod: `Toolbar.svelte`, `ToolbarSeparator.svelte`.
