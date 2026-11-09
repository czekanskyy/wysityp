# TextField

Pole tekstowe z etykietą, podpowiedzią, błędem i opcjonalną ikoną na początku.

- Etykieta zawsze istnieje dla czytników ekranu; `hideLabel` chowa ją wizualnie (pola wyszukiwania).
- Podpowiedź i błąd są połączone przez `aria-describedby`; błąd ustawia `aria-invalid`, obrys `color-danger` i jest ogłaszany (`role="alert"`).
- Fokus: obrys `color-focus-ring` plus miękka poświata.
- Placeholder w `color-text-faint`, nigdy jako zastępstwo etykiety.

Konsument podaje `label`, `value` (bindable), `hint`, `error`. Kod: `TextField.svelte`.
