<script lang="ts">
  interface Props {
    /** Each key is drawn as its own cap, e.g. ["Ctrl", "Shift", "P"]. */
    keys: string[];
  }

  let { keys }: Props = $props();
</script>

<span class="kbd-group">
  {#each keys as key, index (index)}
    <kbd>{key}</kbd>
  {/each}
</span>

<style>
  .kbd-group {
    display: inline-flex;
    gap: var(--space-0-5);
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 1.35rem;
    height: 1.25rem;
    padding: 0 var(--space-1);
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
    line-height: 1;
    color: var(--color-text-muted);
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border);
    border-bottom-width: 2px;
    border-radius: var(--radius-xs);
  }
</style>
