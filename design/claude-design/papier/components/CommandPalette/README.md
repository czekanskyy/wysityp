# CommandPalette

Paleta poleceń pod `Ctrl+K`: dociera do każdej akcji aplikacji i każdej notatki.

- Natywne modalne `<dialog>` (pułapka fokusu, Escape); tło `color-overlay`, panel `color-surface-raised`, `radius-xl`, `shadow-lg`.
- Pole to combobox z `aria-activedescendant`; Góra/Dół, Enter uruchamia. Po zamknięciu fokus wraca na miejsce, potem polecenie się wykonuje.
- Dopasowanie ignoruje wielkość liter i polskie znaki („zrodlo” znajduje „Źródło”) i przeszukuje też `keywords`, więc angielskie słowa znajdują polskie polecenia.
- Grupy (Notatki, Wstaw, Widok) zachowują kolejność trafności. Wybrana opcja: `color-accent-soft`.

Konsument podaje `commands`, `label`, `placeholder`, `emptyText` i przetłumaczone `hints`. Kod: `CommandPalette.svelte`, `commands.ts`.
