<script lang="ts">
  import { icons, type IconName } from "./icons";

  interface Props {
    name: IconName;
    size?: "sm" | "md" | "lg";
    /** Give a label only when the icon stands alone and means something. */
    label?: string;
  }

  let { name, size = "md", label }: Props = $props();
</script>

<svg
  class="icon icon-{size}"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- static markup from icons.ts -->
  {@html icons[name]}
</svg>

<style>
  .icon {
    flex: none;
    display: inline-block;
    vertical-align: middle;
  }

  .icon-sm {
    width: var(--icon-sm);
    height: var(--icon-sm);
  }

  .icon-md {
    width: var(--icon-md);
    height: var(--icon-md);
  }

  .icon-lg {
    width: var(--icon-lg);
    height: var(--icon-lg);
  }
</style>
