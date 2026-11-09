<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  export type TagColor =
    "gray" | "blue" | "green" | "amber" | "red" | "violet" | "teal";

  interface Props {
    color?: TagColor;
    /** When set, the tag is a button (e.g. filter by this subject). */
    onclick?: () => void;
    selected?: boolean;
    /** When set, a small × removes the tag. `removeLabel` is required then. */
    onremove?: () => void;
    removeLabel?: string;
    children: Snippet;
  }

  let {
    color = "gray",
    onclick,
    selected = false,
    onremove,
    removeLabel,
    children,
  }: Props = $props();
</script>

<span
  class="tag"
  style:--fg="var(--tag-{color}-fg)"
  style:--bg="var(--tag-{color}-bg)"
>
  {#if onclick}
    <button
      type="button"
      class="body as-button"
      aria-pressed={selected}
      {onclick}>{@render children()}</button
    >
  {:else}
    <span class="body">{@render children()}</span>
  {/if}
  {#if onremove}
    <button
      type="button"
      class="remove"
      aria-label={removeLabel}
      title={removeLabel}
      onclick={onremove}
    >
      <Icon name="close" size="sm" />
    </button>
  {/if}
</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    height: 1.375rem;
    max-width: 100%;
    color: var(--fg);
    background: var(--bg);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    line-height: 1;
    overflow: hidden;
  }

  .body {
    padding: 0 var(--space-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    height: 100%;
    cursor: pointer;
  }

  .as-button:hover,
  .remove:hover {
    background: color-mix(in srgb, var(--fg), transparent 88%);
  }

  .as-button[aria-pressed="true"] {
    box-shadow: inset 0 0 0 1.5px var(--fg);
    border-radius: var(--radius-sm);
  }

  .remove {
    display: grid;
    place-items: center;
    width: 1.25rem;
    padding: 0;
    margin-left: calc(var(--space-1) * -1);
    opacity: 0.75;
  }

  button:focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: -2px;
    border-radius: var(--radius-sm);
  }
</style>
