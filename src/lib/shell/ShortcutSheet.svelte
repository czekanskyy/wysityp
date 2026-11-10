<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Kbd from "../ui/Kbd.svelte";
  import { rankByFuzzy } from "../ui/fold";

  type Row = {
    id: string;
    label: string;
    group: string;
    shortcut: readonly string[];
    mark?: string;
  };

  type Props = {
    rows: readonly Row[];
    label: string;
    placeholder: string;
    emptyText: string;
    closeLabel: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

  let {
    rows,
    label,
    placeholder,
    emptyText,
    closeLabel,
    open,
    onOpenChange,
  }: Props = $props();

  let query = $state("");
  let wasOpen = false;
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  const filtered = $derived(
    rankByFuzzy(rows, query, (row) =>
      [row.label, row.group, row.mark ?? "", ...row.shortcut].join(" "),
    ),
  );

  function showGroup(index: number): boolean {
    const group = filtered[index]?.group;
    if (!group) return false;
    return index === 0 || filtered[index - 1]?.group !== group;
  }

  function onCancel(event: Event) {
    event.preventDefault();
    onOpenChange(false);
  }

  $effect(() => {
    const dialog = dialogEl;
    if (!dialog) return;
    if (open && !wasOpen) {
      query = "";
      dialog.showModal();
      queueMicrotask(() => inputEl?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
    wasOpen = open;
    return () => {
      if (dialog.open) dialog.close();
    };
  });
</script>

<dialog
  class="palette sheet"
  aria-label={label}
  bind:this={dialogEl}
  oncancel={onCancel}
  onclick={(event) => {
    if (event.target === dialogEl) onOpenChange(false);
  }}
>
  <div class="palette-query">
    <Icon id="settings" />
    <label class="visually-hidden" for="shortcut-query">{label}</label>
    <input
      id="shortcut-query"
      class="palette-input"
      type="text"
      autocomplete="off"
      {placeholder}
      bind:this={inputEl}
      bind:value={query}
    />
    <IconButton
      label={closeLabel}
      icon="close"
      size="sm"
      onclick={() => onOpenChange(false)}
    />
  </div>
  {#if filtered.length === 0}
    <p class="palette-empty">{emptyText}</p>
  {:else}
    <div class="shortcut-list">
      {#each filtered as row, index (row.id)}
        {#if showGroup(index)}
          <div class="palette-group">{row.group}</div>
        {/if}
        <div class="shortcut-row">
          <span class="one-line">{row.label}</span>
          {#if row.mark}
            <span class="shortcut-mark">{row.mark}</span>
          {:else}
            <span></span>
          {/if}
          <Kbd keys={row.shortcut} />
        </div>
      {/each}
    </div>
  {/if}
</dialog>
