Papier to język wizualny WYSITyp, edytora WYSIWYG dla Typst, w którym studenci robią notatki z wykładów. Spokojna, papierowa strona, jeden atramentowy akcent, szeryf do treści, osobny krój do matematyki i cichy, gęsty interfejs dookoła. Źródłem prawdy jest kod: `src/styles/tokens.css`, `src/styles/base.css` i komponenty w `src/lib/ui/` w repozytorium `czekanskyy/wysityp`; ten system jest ich lustrem.

## Zasady

1. **Strona jest produktem.** Interfejs jest mały i szary, notatka dostaje jasną powierzchnię (`color-surface`), szeryf i szeroką kolumnę (`note-measure`). Nic w chrome nie konkuruje ze wzorem.
2. **Jeden akcent.** `color-accent` (atramentowy niebieski) oznacza jedną rzecz, która jest aktywna lub główna: otwartą notatkę, wciśnięty przełącznik, przycisk primary, karetkę. Pozostałe kolory niosą znaczenie (matematyka, stany, etykiety), nigdy dekorację.
3. **Najpierw klawiatura.** Każdy element ma widoczny fokus (`color-focus-ring`) i ścieżkę z klawiatury. Grupy (pasek narzędzi, drzewo, menu) mają jedno miejsce w kolejności Tab i strzałki. Paleta poleceń (`Ctrl+K`) dociera do wszystkiego.
4. **Dwa języki, jeden układ.** Polskie etykiety są o 20–40% dłuższe od angielskich. Każda etykieta zawija się albo kończy wielokropkiem; układy sprawdza się najpierw po polsku.
5. **Offline i natywnie.** Żadnych fontów z sieci. Krój interfejsu to Segoe UI Variable z Windows, a treść i matematyka używają fontów, które dołącza Typst.

## Treść i ton

- Interfejs mówi do studenta na „ty”, krótko i rzeczowo: „Otwórz folder”, „Zapisz”, „Nazwa nie może wychodzić poza otwarty folder.”
- Czasowniki w trybie rozkazującym na przyciskach, rzeczowniki w nagłówkach sekcji. Bez wykrzykników i emoji.
- Wielka litera tylko na początku etykiety („Nowa notatka”, nie „Nowa Notatka”). Nagłówki sekcji paska bocznego są wersalikami przez CSS, nie w tekście.
- Cudzysłowy w treści polskiej: „…”. Myślnik w zakresach i wtrąceniach: półpauza (–).
- Każdy napis istnieje w `messages/pl.json` i `messages/en.json`. Komponenty nie zawierają tekstu, dostają go w propsach.

## Kolor

Każdy kolor ma wartość w motywie jasnym i ciemnym. Motyw domyślnie idzie za Windows; `data-theme="light"` lub `"dark"` na `<html>` go wymusza.

- **Powierzchnie:** chrome, pasek boczny i paski narzędzi na `color-bg`; notatka i karty na `color-surface`; menu, paleta i pola na `color-surface-raised`; bloki kodu na `color-surface-sunken`. Hover i wciśnięcie to półprzezroczyste `color-hover` i `color-pressed`, działają na każdej powierzchni.
- **Tekst:** `color-text` na każdej powierzchni; `color-text-muted` dla etykiet i metadanych (min. 5.1:1); `color-text-faint` tylko dla placeholderów i stanów wyłączonych.
- **Akcent:** tekst na `color-accent` to zawsze `color-on-accent` (w ciemnym motywie ciemny, nie biały). Ciche zaznaczenie: `color-accent-soft` z `color-accent-soft-text`.
- **Stany:** błąd `color-danger`, ostrzeżenie `color-warning`, sukces `color-success`, każdy z wariantem `-soft` na tło. Stan zawsze ma też słowo lub ikonę.
- **Treść notatki:** matematyka ma własny, cichy fiolet (`color-math`, `color-math-soft`), kod `color-code-text` na `color-code-bg`, zakreślenie `color-highlight`, widoczne znaczniki Typst `color-markup`.
- **Etykiety przedmiotów:** pary `tag-<kolor>-fg` / `tag-<kolor>-bg` w siedmiu kolorach.
- **Składnia:** `syntax-*` dla przyszłego podświetlania źródła Typst.

Kontrast (WCAG 2.2): tekst główny 15.5:1 (jasny) i 12.9:1 (ciemny) na stronie; biel na akcencie 7.1:1; każda para etykiety i stanu min. 4.5:1. Pod `prefers-contrast: more` obrysy i tekst pomocniczy ciemnieją.

## Typografia

- **Interfejs** (`font-ui`, Segoe UI Variable): gęsta skala, która nie rośnie z notatką. `text-sm` (13px) dla wierszy, menu i przycisków (500), `text-md` (14px) dla pól i dialogów, `text-xs` (12px) dla metadanych, `text-2xs` (11px, 600, wersaliki, +0.06em) dla nagłówków sekcji.
- **Notatka** (`font-prose`, Libertinus Serif, na Windows awaryjnie Cambria): to krój, którym drukuje Typst, więc strona w edytorze wygląda jak PDF. `note-body` 17/1.65, nagłówki `note-h1` 30, `note-h2` 24, `note-h3` 20, skala ok. 1.25. Cyfry nautyczne w prozie, `hyphens: auto`.
- **Matematyka** (`font-math`, New Computer Modern Math, awaryjnie Cambria Math): w linii 1.08em treści (wyrównane wysokości x), cyfry lining, bez łamania; blokowa wyśrodkowana i przewijana w poziomie. Wzór otwarty jako źródło przechodzi na mono w `color-math` na `color-math-soft`.
- **Kod** (`font-mono`, Cascadia Mono, Consolas): w linii 0.88em, bloki 14/1.55 z obrysem `color-border` i `radius-lg`. Ligatury wyłączone, żeby źródło było dosłowne.

Libertinus Serif i New Computer Modern Math są w aplikacji po stronie Rust (Typst Kit), ale jeszcze nie w widoku WebView; do tego czasu Windows pokazuje Cambria i Cambria Math.

## Odstępy, rozmiary, kształt

- Siatka 4px: `space-1` (4) do `space-16` (64), plus `space-0-5`, `space-1-5`, `space-2-5` dla ciasnego chrome. Odstępy między elementami przez `gap`.
- Kontrolki: `control-sm` 28px (pasek narzędzi, wiersze drzewa, menu), `control-md` 32px (przyciski, pola), `control-lg` 40px (pole palety). Ikony 14, 16 lub 20px.
- Układ: pasek boczny `sidebar-width` (264px, 13–26rem), pasek tytułu `titlebar-height` 44px, paleta `palette-width`.
- Promienie małe, narzędziowe: `radius-xs` 3 (kbd, kod), `radius-sm` 5 (wiersze, etykiety), `radius-md` 7 (przyciski, pola), `radius-lg` 10 (karty, menu, bloki kodu), `radius-xl` 14 (dialogi). Żadnych pigułek poza kropkami.
- Cienie: `shadow-xs` przyciski, `shadow-sm` wybrany segment, `shadow-md` menu i karta na hover, `shadow-lg` paleta. W ciemnym motywie cienie są mocniejsze, a pracę wykonują obrysy.
- Fokus: dwa pierścienie, 2px `color-surface` i 2px `color-focus-ring`; w wierszach drzewa i menu pierścień wewnętrzny.
- Ruch: 90ms hover, 160ms wyskakujące panele, 240ms wolne przejścia, wszystko 0 przy `prefers-reduced-motion`. Nic nie animuje się podczas pisania.

## Ikonografia

42 ikony liniowe na siatce 24px, kreska 1.75, zaokrąglone końce, rysowane dla WYSITyp w `src/lib/ui/icons.ts` (bez paczki ikon). Kolor z `currentColor`: w spoczynku `color-text-muted`, aktywne dziedziczą kolor wiersza. Ikona stojąca sama ma etykietę; obok tekstu jest dekoracyjna (`aria-hidden`). Bez emoji.

## Wzorce

- **Pasek narzędzi edytora:** cofnij, ponów | nagłówek, pogrubienie, kursywa, przekreślenie | listy, cytat | wzór w linii, wzór blokowy, kod, odnośnik, tabela, obraz | przełącznik widoku na końcu.
- **Pasek boczny:** nazwa obszaru i nowa notatka, pole otwierające paletę, sekcja Ostatnie, drzewo folderów, w stopce ustawienia, motyw i stan zapisu.
- **Zapis:** kropka przy niezapisanej notatce w drzewie i słowo w stopce, nigdy sam kolor.
- **Błędy w notatce:** falista linia `color-danger` (ostrzeżenia `color-warning`) i komunikat na liście diagnostyki; zepsuty fragment zostaje widoczny jako źródło.
- **Usuwanie:** czerwona pozycja w menu, potem potwierdzenie z przyciskiem `danger`.

## Komponenty

Podglądy tutaj to statyczne odwzorowania w HTML i `components/bundle.css` (klasy `wt-*`). Działające komponenty Svelte 5 są w `src/lib/ui/` i importuje się je z `src/lib/ui/index.ts`.

## Kolory strony

Motyw interfejsu (jasny, ciemny, systemowy) i kolor strony ustawia się osobno, więc ciemny edytor może mieć jasną kartkę. Są cztery kolory strony: biały, beżowy, grafitowy i czarny (OLED). Każdy ma pięć tokenów `page-<kolor>-bg`, `-text`, `-muted`, `-math` i `-code-bg`, a kontener strony dostaje `data-page="<kolor>"`, który ustawia aliasy `--page-bg`, `--page-text` itd. Treść, wzory i kod na stronie używają tylko aliasów `--page-*`, nigdy `--color-*`. Tekst ma kontrast co najmniej 10.8:1, a podpisy co najmniej 4.5:1 na każdym tle. Eksport PDF domyślnie zawsze daje białą stronę.
