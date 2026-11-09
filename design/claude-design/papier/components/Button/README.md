# Button

Przycisk akcji w czterech wariantach: `primary`, `secondary`, `ghost`, `danger`; rozmiary `sm` (28px) i `md` (32px).

- **primary** (`color-accent` + `color-on-accent`): jedna główna akcja na widok, np. Zapisz.
- **secondary** (`color-surface-raised`, obrys `color-border`): zwykłe akcje.
- **ghost**: akcje drugorzędne w paskach i nagłówkach.
- **danger** (`color-danger-fill`): tylko w potwierdzeniu usunięcia, nigdy jako pierwszy krok.
- `busy` pokazuje spinner, blokuje kliknięcia i ustawia `aria-busy`.

Konsument podaje etykietę (komunikat z `messages/*.json`), opcjonalną ikonę i `onclick`. Promień `radius-md`, cień `shadow-xs`, fokus: dwa pierścienie (`color-surface`, potem `color-focus-ring`). Kod: `src/lib/ui/Button.svelte`.
