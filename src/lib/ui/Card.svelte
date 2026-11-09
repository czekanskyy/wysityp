<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";

  interface Props {
    title: string;
    /** One quiet line under the title: path, date, word count. */
    meta?: string;
    icon?: IconName;
    /** When set, the whole card is one button (open note, use template). */
    onclick?: () => void;
    /** Body: a snippet of the note, a description, tags. */
    children?: Snippet;
    /** Trailing actions in the header (IconButton, Tag). */
    actions?: Snippet;
  }

  let { title, meta, icon, onclick, children, actions }: Props = $props();
</script>

{#snippet content()}
  <span class="head" class:with-actions={!!actions}>
    {#if icon}
      <span class="badge"><Icon name={icon} /></span>
    {/if}
    <span class="titles">
      <span class="title">{title}</span>
      {#if meta}<span class="meta">{meta}</span>{/if}
    </span>
  </span>
  {#if children}
    <span class="body">{@render children()}</span>
  {/if}
{/snippet}

<article class="card" class:interactive={!!onclick}>
  {#if onclick}
    <button type="button" class="hit" {onclick}>{@render content()}</button>
  {:else}
    <div class="hit">{@render content()}</div>
  {/if}
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</article>

<style>
  .card {
    position: relative;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
    transition:
      border-color var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-base) var(--ease-standard),
      translate var(--duration-base) var(--ease-standard);
  }

  .card.interactive:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-md);
    translate: 0 -1px;
  }

  .hit {
    display: grid;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    text-align: left;
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    border-radius: inherit;
  }

  button.hit {
    cursor: pointer;
  }

  button.hit:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .head {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    min-width: 0;
  }

  .head.with-actions {
    padding-right: var(--space-8);
  }

  .badge {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md);
    color: var(--color-accent-soft-text);
    background: var(--color-accent-soft);
  }

  .titles {
    display: grid;
    min-width: 0;
  }

  .title {
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .body {
    display: block;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-ui);
  }

  .actions {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    display: flex;
    gap: var(--space-1);
  }
</style>
