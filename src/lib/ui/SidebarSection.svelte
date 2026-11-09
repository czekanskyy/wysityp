<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    /** Start folded. The section can always be folded by its title. */
    collapsed?: boolean;
    /** Small actions on the right of the title (IconButton size sm). */
    actions?: Snippet;
    children: Snippet;
  }

  let {
    title,
    collapsed = $bindable(false),
    actions,
    children,
  }: Props = $props();
  const uid = $props.id();
</script>

<section class="section">
  <div class="title-row">
    <button
      type="button"
      class="title"
      aria-expanded={!collapsed}
      aria-controls="section-{uid}"
      onclick={() => (collapsed = !collapsed)}
    >
      <span class="chev" class:open={!collapsed}
        ><Icon name="chevronRight" size="sm" /></span
      >
      {title}
    </button>
    {#if actions}<span class="actions">{@render actions()}</span>{/if}
  </div>
  <div id="section-{uid}" hidden={collapsed}>
    {@render children()}
  </div>
</section>

<style>
  .section {
    display: grid;
    gap: var(--space-0-5);
  }

  .title-row {
    display: flex;
    align-items: center;
    min-height: var(--control-sm);
  }

  .title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-sm);
    padding: 0 var(--space-1);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
    color: var(--color-text-muted);
    background: none;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
  }

  .title:hover {
    color: var(--color-text);
  }

  .title:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .chev {
    display: inline-grid;
    transition: rotate var(--duration-fast) var(--ease-standard);
  }

  .chev.open {
    rotate: 90deg;
  }

  .actions {
    display: flex;
    gap: var(--space-0-5);
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-standard);
  }

  .section:hover .actions,
  .section:focus-within .actions {
    opacity: 1;
  }
</style>
