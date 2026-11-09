<script lang="ts">
  let { title, subtitle }: { title: string; subtitle?: string } = $props();
</script>

<div class="cover">
  <p class="cover-title">{title}</p>
  {#if subtitle}
    <p class="cover-subtitle">{subtitle}</p>
  {/if}
</div>
