<script lang="ts">
  let { keys }: { keys: readonly string[] } = $props();
</script>

{#if keys.length > 0}
  <span class="kbd">
    {#each keys as key, index (index)}
      <kbd>{key}</kbd>
    {/each}
  </span>
{/if}
