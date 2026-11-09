<script lang="ts">
  import type { Snippet } from "svelte";
  import type { NotePageColor } from "./types";

  let {
    page = "white",
    children,
  }: { page?: NotePageColor; children?: Snippet } = $props();
</script>

<article class="note" data-page={page}>
  {#if children}
    {@render children()}
  {/if}
</article>
