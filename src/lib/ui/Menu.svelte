<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import type { MenuEntry } from "./menu";
  import { roving } from "./roving";

  interface Props {
    label: string;
    entries: MenuEntry[];
    /** Called after a choice and on Escape. The owner returns focus. */
    onclose?: () => void;
    /** Focus the first item on open (true for popups, false when inline). */
    autofocus?: boolean;
  }

  let { label, entries, onclose, autofocus = true }: Props = $props();
  let list: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (!autofocus) return;
    list
      ?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      )
      ?.focus();
  });

  function choose(entry: Extract<MenuEntry, { id: string }>) {
    if (entry.disabled) return;
    entry.onselect();
    onclose?.();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onclose?.();
    }
  }
</script>

<div
  class="menu"
  role="menu"
  aria-label={label}
  tabindex="-1"
  bind:this={list}
  {onkeydown}
  use:roving={{ selector: '[role="menuitem"]', orientation: "vertical" }}
>
  {#each entries as entry, index ("separator" in entry ? `sep-${index}` : entry.id)}
    {#if "separator" in entry}
      <div class="separator" role="separator"></div>
    {:else}
      <button
        type="button"
        role="menuitem"
        class="item"
        class:danger={entry.danger}
        aria-disabled={entry.disabled || undefined}
        onclick={() => choose(entry)}
      >
        <span class="icon">
          {#if entry.icon}<Icon name={entry.icon} size="sm" />{/if}
        </span>
        <span class="label">{entry.label}</span>
        {#if entry.shortcut}<span class="shortcut">{entry.shortcut}</span>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .menu {
    display: grid;
    min-width: 12rem;
    max-width: 20rem;
    padding: var(--space-1);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
  }

  .menu:focus {
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-sm);
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text);
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .item:hover,
  .item:focus-visible {
    outline: none;
    background: var(--color-hover);
  }

  .item:focus-visible {
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .item[aria-disabled="true"] {
    opacity: 0.45;
    cursor: default;
  }

  .icon {
    display: inline-grid;
    width: var(--icon-sm);
    color: var(--color-text-muted);
  }

  .danger,
  .danger .icon {
    color: var(--color-danger);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .shortcut {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .separator {
    height: 1px;
    margin: var(--space-1) calc(var(--space-1) * -1);
    background: var(--color-border);
  }
</style>
