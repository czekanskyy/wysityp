<script lang="ts">
  import type { Snippet } from "svelte";
  import { roving } from "./roving";

  interface Props {
    /** Accessible name, e.g. "Formatowanie". */
    label: string;
    children: Snippet;
    /** Pushed to the far end (view switch, save state). */
    end?: Snippet;
  }

  let { label, children, end }: Props = $props();
</script>

<div
  class="toolbar"
  role="toolbar"
  aria-label={label}
  aria-orientation="horizontal"
  use:roving={{ selector: "button", orientation: "horizontal" }}
>
  <div class="items">{@render children()}</div>
  {#if end}
    <div class="end">{@render end()}</div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: calc(var(--control-sm) + var(--space-2) * 2);
    padding: var(--space-1-5) var(--space-3);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .items,
  .end {
    display: flex;
    align-items: center;
    gap: var(--space-0-5);
  }

  .items {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .end {
    flex: none;
    gap: var(--space-2);
  }
</style>
