<script lang="ts">
  import { icons, type IconId, type IconPart } from "./icons";

  let { id, size = "md" }: { id: IconId; size?: "sm" | "md" | "lg" } = $props();

  const parts: readonly IconPart[] = $derived(icons[id]);
</script>

<svg class="icon {size}" viewBox="0 0 24 24" aria-hidden="true">
  {#each parts as part, index (index)}
    {#if part.kind === "path"}
      <path d={part.d} />
    {:else if part.kind === "circle"}
      <circle cx={part.cx} cy={part.cy} r={part.r} />
    {:else}
      <rect
        x={part.x}
        y={part.y}
        width={part.width}
        height={part.height}
        rx={part.rx}
      />
    {/if}
  {/each}
</svg>
