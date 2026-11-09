# Tag

Etykieta przedmiotu lub kursu w siedmiu kolorach: `gray`, `blue`, `green`, `amber`, `red`, `violet`, `teal` (pary `tag-<kolor>-fg` na `tag-<kolor>-bg`, min. 5.9:1 w obu motywach).

- `onclick` zmienia ją w filtr (`aria-pressed`, wybrana ma obrys w swoim kolorze).
- `onremove` dodaje × i wymaga `removeLabel`.
- Kolor przypisuje student do przedmiotu, aplikacja go nie wymyśla. Czerwony tylko dla „do poprawy”, nie dla przedmiotu.

Kod: `Tag.svelte`.
