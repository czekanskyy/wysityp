<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Accessible name of the landmark, e.g. "Notatki". */
    label: string;
    /** Workspace name, search, new note. Stays put while the body scrolls. */
    header?: Snippet;
    children: Snippet;
    /** Settings, language, theme. */
    footer?: Snippet;
  }

  let { label, header, children, footer }: Props = $props();
</script>

<nav class="sidebar" aria-label={label}>
  {#if header}<div class="header">{@render header()}</div>{/if}
  <div class="body">{@render children()}</div>
  {#if footer}<div class="footer">{@render footer()}</div>{/if}
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: var(--sidebar-width);
    min-width: var(--sidebar-min);
    max-width: var(--sidebar-max);
    height: 100%;
    min-height: 0;
    background: var(--color-bg);
    border-right: 1px solid var(--color-border);
    font-size: var(--text-sm);
  }

  .header {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3) var(--space-2);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--space-1) var(--space-2) var(--space-4);
    display: grid;
    align-content: start;
    gap: var(--space-4);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
  }
</style>
