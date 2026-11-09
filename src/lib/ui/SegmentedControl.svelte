<script lang="ts" generics="T extends string">
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";

  interface Option {
    value: T;
    label: string;
    icon?: IconName;
    /** Show only the icon; the label stays as the accessible name. */
    iconOnly?: boolean;
  }

  interface Props {
    label: string;
    options: Option[];
    value: T;
    onchange?: (value: T) => void;
  }

  let { label, options, value = $bindable(), onchange }: Props = $props();

  let group: HTMLDivElement | undefined = $state();

  function choose(next: T) {
    value = next;
    onchange?.(next);
  }

  function targetIndex(key: string, index: number): number | null {
    if (key === "ArrowRight" || key === "ArrowDown") return index + 1;
    if (key === "ArrowLeft" || key === "ArrowUp") return index - 1;
    if (key === "Home") return 0;
    if (key === "End") return options.length - 1;
    return null;
  }

  function onkeydown(event: KeyboardEvent) {
    const index = options.findIndex((option) => option.value === value);
    const target = targetIndex(event.key, index);
    if (target === null) return;
    event.preventDefault();
    const next = (target + options.length) % options.length;
    choose(options[next].value);
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
</script>

<div
  class="segmented"
  role="radiogroup"
  aria-label={label}
  bind:this={group}
  {onkeydown}
  tabindex="-1"
>
  {#each options as option (option.value)}
    {@const checked = option.value === value}
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={option.iconOnly ? option.label : undefined}
      title={option.iconOnly ? option.label : undefined}
      tabindex={checked ? 0 : -1}
      onclick={() => choose(option.value)}
    >
      {#if option.icon}<Icon name={option.icon} size="sm" />{/if}
      {#if !option.iconOnly}<span>{option.label}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .segmented:focus {
    outline: none;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: calc(var(--control-sm) - 6px);
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: calc(var(--radius-md) - 2px);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }

  button:hover {
    color: var(--color-text);
  }

  button[aria-checked="true"] {
    color: var(--color-text);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-sm);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
</style>
