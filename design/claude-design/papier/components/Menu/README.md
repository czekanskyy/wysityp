# Menu

Menu kontekstowe i rozwijane: wiersze z ikoną, skrótem, stanem `danger` lub `disabled` i separatorami.

- `role="menu"`; przy otwarciu fokus trafia na pierwszą pozycję, strzałki przechodzą, Escape i Tab zamykają i oddają fokus przyciskowi.
- **MenuButton** to wyzwalacz (`aria-haspopup="menu"`, `aria-expanded`); kliknięcie poza zamyka.
- Panel `color-surface-raised`, `radius-lg`, `shadow-md`; pozycje 28px.
- Usunięcie jest czerwone (`color-danger`) i zawsze prowadzi do potwierdzenia.

Konsument podaje `label` i listę `entries` z etykietami z komunikatów. Kod: `Menu.svelte`, `MenuButton.svelte`.
