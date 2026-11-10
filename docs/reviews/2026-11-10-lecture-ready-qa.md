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

## Round 2

Drove the same window, still on port 1430 because 1420 was taken. The dev-port edits were not committed. Scratch notes lived under the system temp directory and were removed. The owner's settings file was restored to the snapshot taken before the session. The OneDrive lecture folder was not opened. Testing stopped after the Save As failure so the fix could ship; items below that line were not opened.

| Check | Result |
| --- | --- |
| 1. Ctrl+S on a draft | Fail, then fixed in this branch. The native Save As dialog opened. Saving into the scratch folder kept the tab and the text, and the file on disk held that text. Typing more after the dialog left the new words only in the editor. A toast said the write had failed at `drafts\untitled.typ` (file not found). The moved file stayed at the old sentence. |
| 2. Folder, three tabs, switch, close, rename, delete | Not reached. |
| 3. Ctrl+O a note outside the folder | Not reached. |
| 4. Kill after two seconds, then restart | Not reached. |
| 5. Paste an image into a folder note and a draft | Not reached. |
| 6. Source, split, and a Typst error | Not reached. |
| 7. Export PDF | Not reached. |
| 8. Light/white, dark/oled, English, shortcut sheet | Not reached. The cold window was Polish, dark, graphite, and the round-1 empty sidebar sentence was still there. |
| 9. 5 000 words, 30 formulas, type in the middle | Not reached. The note was generated and not opened. |

### What was fixed

Save As moved the draft, then a save that still named `untitled.typ` failed and the tab stopped writing the new file. The window blur from the dialog was flushing that old path, and a focus check that started before the move could mark the tab after the path had changed. While the dialog is open the window ignores blur and focus. After the move the tab epoch advances, so an in-flight check or save for the draft path cannot fail the new file, and editor text that differs from the moved bytes is written to the new path. A missing source after a copy-and-delete move is not an error when the destination already has the note. This was not driven again in the window after the code change.

### Still open

| Issue | Severity | In a lecture |
| --- | --- | --- |
| Items 2–9 above were not exercised. | — | Use one folder of `.typ` files. Pause about a second after a sentence before closing the app. PDF export writes beside the note; there is no save dialog. |
| After Save As, confirm the new file on disk once before relying on it. The follow-up save is fixed here and was not re-checked on screen. | High until this build is the one running | If a toast names `drafts\untitled.typ`, select all, copy, close the tab, and open the file you just saved with Ctrl+O. Keep typing in that tab. |
| Caret inside a list item still shows the source marker (`-` or `+`). | Low | Click the next paragraph. |
| Sidebar repeats "Notatki, które otworzysz, pojawią się tutaj." while no folder is open. | Low | Use the three welcome actions. |
