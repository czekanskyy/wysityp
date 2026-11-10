# Typing latency (AC-8)

Measured during the feature 6 build, on Windows, in this worktree. The clock is `performance.now` around one `EditorState.update` that inserts a single letter. The state is `createEditorState` from `src/lib/editor.ts` with rendered mode on, so the update runs the span field, the dirty-window classify, and the decoration rebuild. There is no DOM and no Typst compile.

The fixture is the same shape as the long-note test: a Polish heading, a list, a quote, and 520 paragraphs that include `zażółć gęślą jaźń` or `łódź i źródło`, plus `$a+b$` on every 25th paragraph (21 math spans). One warmup insert ran before the samples. Each sample inserts `ę` in the middle of `Akapit 260`.

| | |
|---|---|
| Words | 5794 |
| Characters | 38812 |
| Samples (ms) | 1.20, 1.38, 1.53, 2.38, 2.92, 5.94, 6.69 |
| Median | 2.38 ms |
| Budget | 16 ms |

The median is under the one-frame budget. This file records the measurement. No unit test fails on the timer.
