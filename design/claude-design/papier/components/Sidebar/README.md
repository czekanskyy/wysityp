# Sidebar

Kolumna nawigacji po notatkach: stały nagłówek (obszar roboczy, nowa notatka, pole otwierające paletę), przewijane sekcje i stopka (ustawienia, motyw, stan zapisu).

- **Sidebar**: landmark `<nav>` z etykietą, tło `color-bg`, szerokość `sidebar-width`.
- **SidebarSection**: zwijana sekcja; tytuł 11px wersalikami w `color-text-muted`, przycisk z `aria-expanded`; akcje sekcji pojawiają się na hover i przy fokusie.
- **Tree / TreeItem**: płaskie drzewo ARIA z `aria-level`. Góra/Dół przechodzą między wierszami, Prawo otwiera folder, Lewo zamyka, Enter lub Spacja otwiera notatkę. Wcięcie 16px na poziom.
- Aktywna notatka: `color-accent-soft` + `color-accent-soft-text`. Fokus klawiatury: wewnętrzny pierścień `color-focus-ring`.
- Niezapisana notatka ma kropkę w `badge`, stan „Zapisano” w stopce w `color-success`. Nigdy sam kolor.

Kolejność sekcji: Ostatnie, potem drzewo folderów. Kod: `Sidebar.svelte`, `SidebarSection.svelte`, `Tree.svelte`, `TreeItem.svelte`.
