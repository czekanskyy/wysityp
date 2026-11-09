<script lang="ts">
  import type { Snippet } from "svelte";
  import { roving } from "./roving";

  interface Props {
    label: string;
    /** TreeItem components. */
    children: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<div
  class="tree"
  role="tree"
  aria-label={label}
  use:roving={{ selector: '[role="treeitem"]', orientation: "vertical" }}
>
  {@render children()}
</div>

<style>
  .tree {
    display: grid;
    gap: 1px;
  }
</style>
