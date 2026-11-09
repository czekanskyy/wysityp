<script lang="ts" module>
  let paletteSeq = 0;

  function nextPaletteId(): string {
    paletteSeq += 1;
    return `palette-${paletteSeq}`;
  }
</script>

<script lang="ts">
  import Icon from "./Icon.svelte";
  import Kbd from "./Kbd.svelte";
  import { commandMatches } from "./fold";
  import type { CommandItem } from "./types";

  type Props = {
    commands: readonly CommandItem[];
    label: string;
    placeholder: string;
    emptyText: string;
    hints: readonly string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRun: (id: string) => void;
  };

  let {
    commands,
    label,
    placeholder,
    emptyText,
    hints,
    open,
    onOpenChange,
    onRun,
  }: Props = $props();

  // The caller sets open. This component does not listen for a global shortcut.
  const paletteId = nextPaletteId();
  let query = $state("");
  let active = $state(0);
  let wasOpen = false;
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);

  const filtered = $derived(
    commands.filter((command) => commandMatches(command.label, query)),
  );
  const activeIndex = $derived(
    filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1),
  );

  function showGroup(index: number): boolean {
    const group = filtered[index]?.group;
    if (!group) return false;
    return index === 0 || filtered[index - 1]?.group !== group;
  }

  function run(command: CommandItem) {
    onRun(command.id);
    onOpenChange(false);
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) return;
      active =
        event.key === "ArrowDown"
          ? (activeIndex + 1) % filtered.length
          : (activeIndex - 1 + filtered.length) % filtered.length;
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) run(command);
    }
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
      active = 0;
      dialog.showModal();
      queueMicrotask(() => inputEl?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
    wasOpen = open;
  });

  $effect(() => {
    if (!open || filtered.length === 0) return;
    document
      .getElementById(`${paletteId}-opt-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  });
</script>

<dialog
  class="palette"
  aria-label={label}
  bind:this={dialogEl}
  oncancel={onCancel}
  onkeydown={onKey}
>
  <div class="palette-query">
    <Icon id="search" />
    <label class="visually-hidden" for="{paletteId}-query">{label}</label>
    <input
      id="{paletteId}-query"
      class="palette-input"
      type="text"
      role="combobox"
      autocomplete="off"
      {placeholder}
      bind:this={inputEl}
      bind:value={query}
      aria-autocomplete="list"
      aria-expanded="true"
      aria-controls="{paletteId}-list"
      aria-activedescendant={filtered.length
        ? `${paletteId}-opt-${activeIndex}`
        : undefined}
      oninput={() => (active = 0)}
    />
  </div>
  {#if filtered.length === 0}
    <p class="palette-empty">{emptyText}</p>
  {:else}
    <div class="palette-list" id="{paletteId}-list" role="listbox">
      {#each filtered as command, index (command.id)}
        {#if showGroup(index)}
          <div class="palette-group" role="presentation">{command.group}</div>
        {/if}
        <div
          id="{paletteId}-opt-{index}"
          class="palette-option"
          role="option"
          tabindex="-1"
          aria-selected={index === activeIndex}
          onpointerdown={(event) => {
            event.preventDefault();
            active = index;
          }}
          onclick={() => run(command)}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            run(command);
          }}
        >
          {#if command.icon}
            <Icon id={command.icon} />
          {/if}
          <span class="one-line" title={command.label}>{command.label}</span>
          {#if command.shortcut?.length}
            <Kbd keys={command.shortcut} />
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  {#if hints.length > 0}
    <div class="palette-foot">
      {#each hints as hint, index (index)}
        <span>{hint}</span>
      {/each}
    </div>
  {/if}
</dialog>
