# NoteTypography

Wygląd treści notatki na stronie, po której się pisze. To nie komponent Svelte, tylko klasy z `src/styles/base.css` (`.note-prose`, `.note-math-inline`, `.note-math-block`, `.note-math-source`, `.note-code-inline`, `.note-code-block`, `.note-markup`, `.note-error`, `.note-warning`), które używają dekoracje edytora ze specu 0002.

- Proza: `font-prose`, styl `note-body` (17/1.65), kolumna `note-measure`, `hyphens: auto` z `lang` ustawionym z ustawień.
- Nagłówki `note-h1`–`note-h3`, cytat z linią `color-border-strong`, zakreślenie `color-highlight`.
- Matematyka w linii: `font-math` w 1.08em, cyfry lining, bez łamania. Blokowa: wyśrodkowana, przewija się w poziomie.
- Matematyka otwarta jako źródło: mono w `color-math` na `color-math-soft`, z dolarami, żeby było widać granice wzoru.
- Kod: `font-mono` 0.88em na `color-code-bg`; bloki z obrysem i `radius-lg`.
- Błąd Typst: falista linia `color-danger` (ostrzeżenie `color-warning`), fragment zostaje widoczny jako źródło.
