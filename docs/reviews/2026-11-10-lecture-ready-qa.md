# Lecture-ready QA, 2026-11-10

Drove the real window (`bun run tauri dev` on port 1430, because 1420 was already taken) after `origin/main` including PR #13. Page colour graphite, theme system, language Polish. Scratch notes lived under the system temp directory and were removed. The owner's settings file was restored to the snapshot taken before the session: Polish, graphite, system theme, empty global recents, empty session. The OneDrive lecture folder was not opened.

## What passed

| Check | Result |
| --- | --- |
| Cold welcome | Pass. App name, Nowa notatka (Ctrl+N), Otwórz notatkę (Ctrl+O), Otwórz folder (Ctrl+Shift+O), and an empty Ostatnie list. Nothing else on the page. |
| New draft, type immediately | Pass, after the caret fix. The placeholder word is selected. Typing `Analiza` replaced `Tytuł` and the line stayed a heading. |
| Polish letters, bold, italic | Pass. `ą ć ę ł ń ó ś ź ż` and the capitals render. `*…*` is bold, `_…_` is italic. |
| Lists | Pass, after the marker fix. A bullet shows `•`. A numbered item shows `1.` with a gap before the words. Enter continues an item. Enter on an empty item ends the list, and the next paragraph stays a paragraph. |
| Quote and math | Pass. `#quote[…]` renders as a quote. Inline `$x^2 + y^2 = r^2$` and a block with a fraction, a sum, an integral, and an aligned derivation typeset on the graphite page. |
| Code fence | Pass once the caret is outside the list. A fence typed while the caret was still inside a list item picked up `+` markers. That path is the list-exit fix below. |
| Autosave | Pass. After typing settled, the draft file on disk matched the note, about a second later. Settled screenshots did not flicker. |
| Toolbar | Pass for the buttons that were exercised. The bar sits under the tabs, wraps to a second row, and stays readable on the dark page. Bold and italic on a selected word changed the Typst source and the page. |
| Command palette | Pass. F1 opens it. Polish labels, shortcuts, filter field, and the footer (arrows, Enter, Escape). Escape closes it. |
| Restart | Pass. After the dev process rebuilt, the open draft tab came back with the note. |

## What was fixed

1. A new note put the caret at position 0. The heading marker is hidden, so the first letters were inserted before `=` and the heading collapsed. A blank `= Tytuł` or `= Title` now selects that word, unless a restored editor state or a diagnostic jump already chose a place.
2. Enter on an empty list item removed the marker but left the next line inside the item. The following Enter put the marker back, including into a code fence. The empty item now leaves a blank line above the caret, so the next paragraph is outside the list.
3. A bullet hid `- ` and drew nothing, so a list looked like body text. A numbered item drew `1.` glued to the word (`1.wniosek`). Bullets now draw `•`, and the number has a gap.
4. The code-block button replaced a selection with an empty fence. The fence now keeps the selected text. Ctrl+Shift+K already did.
5. WebView2 handled F1 and Ctrl+P as print. F1 opened a "Drukowanie nie powiodło się" dialog over the note, so the palette never opened. Browser accelerator keys are turned off for the window. F1 then opened the palette.

## Still open

These were not fixed. None of them ate a note during the session.

| Issue | Severity | In a lecture |
| --- | --- | --- |
| With the caret inside a list item, that item shows its source marker (`-` or `+`) instead of the bullet or the number. | Low | Click the next paragraph. The marker becomes a bullet or a number again. |
| The sidebar repeats "Notatki, które otworzysz, pojawią się tutaj." while no folder is open. | Low | Use the three welcome actions. The sidebar line is the same empty state. |
| Save As (Ctrl+S on a draft), image paste, opening a folder and several tabs, source and split view, a Typst error on the span, PDF export, light theme, the other page colours, English, the shortcut sheet (Ctrl+/), and a 5 000-word note were not confirmed on screen in this pass. | — | Autosave already writes the draft. If Ctrl+S does not show a dialog, F1 and "Zapisz notatkę" is the same command. Do not press F5. |
| Killing the process three seconds after a keystroke was inconclusive: the marker had not appeared on screen yet, so it was not a saved character that then vanished. | — | Pause for about a second after a sentence. The earlier autosave check wrote the whole note. |

Disabled toolbar buttons (superscript, subscript, colour, and the rest of that row) are visible and do not insert text. Their "coming soon" tooltip was not hovered long enough to confirm.

## Decision

The print shortcut and the heading caret would have stopped a lecture. Both are fixed here. The list and code-block fixes are the same class of "the source is no longer what was typed." Cosmetic chrome was left alone so it can merge with later shell work.
