<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import IconButton from "../ui/IconButton.svelte";
  import Menu from "../ui/Menu.svelte";
  import SegmentedControl from "../ui/SegmentedControl.svelte";
  import type { IconId } from "../ui/icons";
  import type { MenuEntry, SegmentOptions } from "../ui/types";
  import type { NoteView } from "../noteSafety";
  import type { Session } from "../state/session.svelte";
  import {
    canInsertImage,
    formatShortcut,
    runFormat,
    runImage,
    type FormatAction,
  } from "../toolbarActions";

  let { session }: { session: Session } = $props();

  let tableOpen = $state(false);
  let tableRows = $state(2);
  let tableCols = $state(3);
  let tableWrap = $state<HTMLDivElement | null>(null);
  const tableCells = [0, 1, 2, 3, 4, 5];

  const copy = $derived.by(() => {
    void session.locale;
    return {
      toolbar: m.toolbar_label(),
      soon: m.coming_soon(),
      paragraph: m.paragraph_style(),
      body: m.body_text(),
      heading1: m.heading_1(),
      heading2: m.heading_2(),
      heading3: m.heading_3(),
      bold: m.bold(),
      italic: m.italic(),
      underline: m.underline(),
      strike: m.strike(),
      code: m.inline_code(),
      bullet: m.bullet_list(),
      numbered: m.numbered_list(),
      quote: m.quote(),
      inlineMath: m.inline_math(),
      blockMath: m.block_math(),
      codeBlock: m.code_block(),
      link: m.insert_link(),
      table: m.insert_table(),
      image: m.insert_image(),
      superscript: m.superscript(),
      subscript: m.subscript(),
      highlight: m.highlight(),
      textColor: m.text_color(),
      term: m.term_list(),
      outdent: m.outdent(),
      indent: m.indent(),
      align: m.align(),
      symbol: m.symbol(),
      shape: m.shape(),
      footnote: m.footnote(),
      reference: m.reference(),
      blocks: m.blocks(),
      undo: m.undo(),
      redo: m.redo(),
      tablePicker: m.table_picker(),
      exportPdf: m.export_pdf(),
      view: m.view_switch(),
      source: m.view_source(),
      split: m.view_split(),
      page: m.view_rendered(),
    };
  });

  const imageReady = $derived(
    session.editor ? canInsertImage(session.editor) : false,
  );
  const exportDisabled = $derived(
    !session.active || session.active.kind === "template" || session.exporting,
  );

  const viewOptions = $derived<SegmentOptions>([
    { value: "source", label: copy.source, icon: "code", iconOnly: true },
    { value: "split", label: copy.split, icon: "split", iconOnly: true },
    { value: "rendered", label: copy.page, icon: "page", iconOnly: true },
  ]);

  const styleEntries = $derived<MenuEntry[]>([
    {
      label: copy.body,
      shortcut: formatShortcut["heading-0"],
      onclick: () => edit("heading-0"),
    },
    {
      label: copy.heading1,
      shortcut: formatShortcut["heading-1"],
      onclick: () => edit("heading-1"),
    },
    {
      label: copy.heading2,
      shortcut: formatShortcut["heading-2"],
      onclick: () => edit("heading-2"),
    },
    {
      label: copy.heading3,
      shortcut: formatShortcut["heading-3"],
      onclick: () => edit("heading-3"),
    },
  ]);

  function soon(label: string): string {
    return `${label} (${copy.soon})`;
  }

  function focusEditor() {
    session.editor?.focus();
  }

  function edit(
    action: FormatAction,
    options?: { rows: number; cols: number },
  ) {
    const editor = session.editor;
    if (!editor) return;
    runFormat(editor, action, options);
    editor.focus();
  }

  function keepCaret(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, a")) event.preventDefault();
  }

  function pickTable(rows: number, cols: number) {
    tableOpen = false;
    edit("table", { rows, cols });
  }

  function insertImage() {
    const editor = session.editor;
    if (!editor || !canInsertImage(editor)) return;
    runImage(editor);
    editor.focus();
  }

  function setView(value: string) {
    if (value === "source" || value === "split" || value === "rendered") {
      session.setView(value as NoteView);
    }
    focusEditor();
  }

  $effect(() => {
    if (!tableOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (tableWrap?.contains(target)) return;
      tableOpen = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      tableOpen = false;
      focusEditor();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

{#snippet soonButton(icon: IconId, label: string)}
  <IconButton {icon} {label} size="sm" disabled tip={soon(label)} />
{/snippet}

{#snippet command(
  icon: IconId,
  label: string,
  action: FormatAction,
  mark: string,
)}
  <IconButton
    {icon}
    {label}
    size="sm"
    shortcut={formatShortcut[action]}
    tip={mark ? `${label} (${mark})` : undefined}
    onclick={() => edit(action)}
  />
{/snippet}

<div
  class="editor-toolbar"
  role="toolbar"
  aria-label={copy.toolbar}
  tabindex="-1"
  onmousedown={keepCaret}
>
  <div class="editor-tools">
    <IconButton
      icon="undo"
      label={copy.undo}
      size="sm"
      shortcut={["Ctrl", "Z"]}
      onclick={() => {
        session.editor?.undo();
        focusEditor();
      }}
    />
    <IconButton
      icon="redo"
      label={copy.redo}
      size="sm"
      shortcut={["Ctrl", "Y"]}
      onclick={() => {
        session.editor?.redo();
        focusEditor();
      }}
    />
    <span class="editor-sep" aria-hidden="true"></span>
    <Menu
      label={copy.paragraph}
      entries={styleEntries}
      compact
      wide
      returnFocus={false}
      onClose={focusEditor}
    />
    <span class="editor-sep" aria-hidden="true"></span>
    {@render command("bold", copy.bold, "bold", "")}
    {@render command("italic", copy.italic, "italic", "")}
    {@render command("underline", copy.underline, "underline", "")}
    {@render command("strike", copy.strike, "strike", "")}
    {@render soonButton("superscript", copy.superscript)}
    {@render soonButton("subscript", copy.subscript)}
    {@render command("code", copy.code, "code", "")}
    {@render soonButton("highlight", copy.highlight)}
    {@render soonButton("textColor", copy.textColor)}
    <span class="editor-sep" aria-hidden="true"></span>
    {@render command("bulletList", copy.bullet, "bullet", "-")}
    {@render command("numberedList", copy.numbered, "numbered", "+")}
    {@render soonButton("termList", copy.term)}
    {@render command("quote", copy.quote, "quote", "")}
    {@render soonButton("outdent", copy.outdent)}
    {@render soonButton("indent", copy.indent)}
    {@render soonButton("align", copy.align)}
    <span class="editor-sep" aria-hidden="true"></span>
    {@render command("inlineMath", copy.inlineMath, "math-inline", "")}
    {@render command("blockMath", copy.blockMath, "math-block", "")}
    {@render soonButton("symbol", copy.symbol)}
    <div class="table-wrap" bind:this={tableWrap}>
      <IconButton
        icon="table"
        label={copy.table}
        size="sm"
        pressed={tableOpen}
        onclick={() => (tableOpen = !tableOpen)}
      />
      {#if tableOpen}
        <div class="table-pop" role="group" aria-label={copy.tablePicker}>
          <div class="table-grid">
            {#each tableCells as row (row)}
              {#each tableCells as col (col)}
                <button
                  type="button"
                  class="table-cell"
                  class:on={row < tableRows && col < tableCols}
                  aria-label={`${row + 1}×${col + 1}`}
                  onpointerenter={() => {
                    tableRows = row + 1;
                    tableCols = col + 1;
                  }}
                  onclick={() => pickTable(row + 1, col + 1)}
                ></button>
              {/each}
            {/each}
          </div>
          <p>{tableRows}×{tableCols}</p>
        </div>
      {/if}
    </div>
    <IconButton
      icon="image"
      label={copy.image}
      size="sm"
      disabled={!imageReady}
      tip={imageReady ? copy.image : soon(copy.image)}
      onclick={insertImage}
    />
    {@render soonButton("shape", copy.shape)}
    {@render command("codeBlock", copy.codeBlock, "code-block", "")}
    {@render command("link", copy.link, "link", "")}
    {@render soonButton("footnote", copy.footnote)}
    {@render soonButton("mention", copy.reference)}
    <span class="editor-sep" aria-hidden="true"></span>
    {@render soonButton("blocks", copy.blocks)}
  </div>
  <div class="editor-end">
    <IconButton
      icon="export"
      label={copy.exportPdf}
      size="sm"
      disabled={exportDisabled}
      onclick={() => {
        void session.exportPdf();
        focusEditor();
      }}
    />
    <SegmentedControl
      label={copy.view}
      options={viewOptions}
      value={session.viewMode}
      onchange={setView}
    />
  </div>
</div>
