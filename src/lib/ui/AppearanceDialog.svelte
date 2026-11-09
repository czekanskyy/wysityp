<script lang="ts">
  import type { Settings } from "../../bindings";
  import { api } from "../api";
  import type { NotePageColor } from "./types";
  import Button from "./Button.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import type { SegmentOptions } from "./types";

  type PageChoice = {
    id: NotePageColor;
    label: string;
    sheet: string;
  };

  let {
    open,
    restore,
    theme,
    pageColor,
    title,
    themeLabel,
    themeHint,
    systemLabel,
    lightLabel,
    darkLabel,
    pageColorLabel,
    pageColorHint,
    whiteLabel,
    beigeLabel,
    graphiteLabel,
    oledLabel,
    preview,
    closeLabel,
    onClose,
    onSaved,
    onFailed,
  }: {
    open: boolean;
    restore: HTMLElement | null;
    theme: string;
    pageColor: NotePageColor;
    title: string;
    themeLabel: string;
    themeHint: string;
    systemLabel: string;
    lightLabel: string;
    darkLabel: string;
    pageColorLabel: string;
    pageColorHint: string;
    whiteLabel: string;
    beigeLabel: string;
    graphiteLabel: string;
    oledLabel: string;
    preview: string;
    closeLabel: string;
    onClose: () => void;
    onSaved: (settings: Settings) => void;
    onFailed: (error: unknown) => void;
  } = $props();

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let themeGroup = $state<HTMLElement | null>(null);
  let pageGroup = $state<HTMLElement | null>(null);
  let busy = $state(false);
  let wasOpen = false;

  const themeOptions = $derived([
    { value: "system", label: systemLabel },
    { value: "light", label: lightLabel },
    { value: "dark", label: darkLabel },
  ] as SegmentOptions);

  const pages = $derived<PageChoice[]>([
    { id: "white", label: whiteLabel, sheet: "sheet-white" },
    { id: "beige", label: beigeLabel, sheet: "sheet-beige" },
    { id: "graphite", label: graphiteLabel, sheet: "sheet-graphite" },
    { id: "oled", label: oledLabel, sheet: "sheet-oled" },
  ]);

  function focusChecked(root: HTMLElement | null) {
    root
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }

  async function commitTheme(next: string) {
    if (busy) return;
    busy = true;
    try {
      const saved = await api.setTheme(next);
      onSaved(saved);
      queueMicrotask(() => focusChecked(themeGroup));
    } catch (error) {
      onFailed(error);
      queueMicrotask(() => focusChecked(themeGroup));
    } finally {
      busy = false;
    }
  }

  async function commitPage(next: NotePageColor) {
    if (busy || next === pageColor) return;
    busy = true;
    try {
      const saved = await api.setPageColor(next);
      onSaved(saved);
      queueMicrotask(() => focusChecked(pageGroup));
    } catch (error) {
      onFailed(error);
      queueMicrotask(() => focusChecked(pageGroup));
    } finally {
      busy = false;
    }
  }

  function requestTheme(next: string): false {
    void commitTheme(next);
    return false;
  }

  function onPageKey(event: KeyboardEvent) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    if (busy) return;
    const ids = pages.map((page) => page.id);
    let index = ids.indexOf(pageColor);
    if (index < 0) index = 0;
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = ids.length - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      index = (index + 1) % ids.length;
    } else {
      index = (index - 1 + ids.length) % ids.length;
    }
    const next = ids[index];
    if (next !== undefined) void commitPage(next);
  }

  function onCancel(event: Event) {
    event.preventDefault();
    onClose();
  }

  $effect(() => {
    const dialog = dialogEl;
    if (!dialog) return;
    if (open && !wasOpen) {
      if (!dialog.open) dialog.showModal();
      queueMicrotask(() => focusChecked(themeGroup));
    } else if (!open && dialog.open) {
      dialog.close();
      restore?.focus();
    }
    wasOpen = open;
  });
</script>

<dialog
  class="appearance"
  aria-labelledby="appearance-title"
  bind:this={dialogEl}
  oncancel={onCancel}
>
  <div class="appearance-body">
    <h2 id="appearance-title" class="text-lg">{title}</h2>

    <div class="appearance-theme" bind:this={themeGroup}>
      <p class="appearance-kicker text-sm" aria-hidden="true">{themeLabel}</p>
      <SegmentedControl
        label={themeLabel}
        options={themeOptions}
        value={theme}
        {busy}
        describedBy="appearance-theme-hint"
        onchange={requestTheme}
      />
      <p id="appearance-theme-hint" class="appearance-hint text-sm">
        {themeHint}
      </p>
    </div>

    <div
      class="appearance-pages"
      role="radiogroup"
      aria-label={pageColorLabel}
      aria-describedby="appearance-page-hint"
      tabindex="-1"
      bind:this={pageGroup}
      onkeydown={onPageKey}
    >
      <p class="appearance-kicker text-sm" aria-hidden="true">
        {pageColorLabel}
      </p>
      {#each pages as page (page.id)}
        <button
          type="button"
          class="swatch"
          role="radio"
          aria-checked={pageColor === page.id}
          title={page.label}
          disabled={busy}
          tabindex={pageColor === page.id ? 0 : -1}
          onclick={() => void commitPage(page.id)}
        >
          <span class="swatch-sheet {page.sheet}" aria-hidden="true"></span>
          <span class="one-line">{page.label}</span>
        </button>
      {/each}
      <p id="appearance-page-hint" class="appearance-hint text-sm">
        {pageColorHint}
      </p>
    </div>

    <div class="appearance-preview" data-page={pageColor}>
      <p class="appearance-sample">{preview}</p>
      <p class="appearance-muted">{pageColorHint}</p>
      <p class="appearance-math math-inline">a + b</p>
      <p class="appearance-code code-inline">#set page</p>
    </div>

    <div class="appearance-actions">
      <Button variant="secondary" label={closeLabel} onclick={onClose} />
    </div>
  </div>
</dialog>
