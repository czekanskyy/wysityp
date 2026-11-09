<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import type { IconId } from "./icons";

  type Props = {
    title: string;
    meta?: string;
    description?: string;
    icon?: IconId;
    onclick?: () => void;
    actions?: Snippet;
  };

  let { title, meta, description, icon, onclick, actions }: Props = $props();
</script>

{#snippet body(titleIsButton: boolean)}
  <div class="card-head" class:has-actions={Boolean(actions)}>
    {#if icon}
      <span class="card-badge"><Icon id={icon} /></span>
    {/if}
    <div class="card-text">
      {#if titleIsButton}
        <button
          type="button"
          class="card-title-btn"
          {title}
          onclick={() => onclick?.()}
        >
          <span class="card-title one-line">{title}</span>
        </button>
      {:else}
        <div class="card-title one-line" {title}>{title}</div>
      {/if}
      {#if meta}
        <div class="card-meta one-line" title={meta}>{meta}</div>
      {/if}
    </div>
  </div>
  {#if description}
    <p class="card-copy">{description}</p>
  {/if}
{/snippet}

{#if onclick && !actions}
  <button type="button" class="card" {title} {onclick}>
    {@render body(false)}
  </button>
{:else}
  <div class="card">
    {@render body(Boolean(onclick))}
    {#if actions}
      <div class="card-actions">{@render actions()}</div>
    {/if}
  </div>
{/if}
