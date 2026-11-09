# IconButton

Przycisk z samą ikoną, do paska narzędzi i akcji w wierszach. `label` jest wymagany: staje się `aria-label` i podpowiedzią (z dopisanym skrótem, np. „Pogrubienie (Ctrl+B)”).

- `pressed` zmienia go w przełącznik (`aria-pressed`), wciśnięty ma tło `color-accent-soft` i ikonę `color-accent-soft-text`.
- W spoczynku ikona `color-text-muted`, na hover `color-hover` i `color-text`.
- Rozmiar `sm` (28px) w paskach i wierszach, `md` (32px) samodzielnie.

**Kbd** rysuje klawisze skrótów (`["Ctrl", "K"]`) na `color-surface-sunken` z `radius-xs`. Kod: `IconButton.svelte`, `Kbd.svelte`.
