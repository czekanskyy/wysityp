<script lang="ts">
  import { showsSource } from "../noteSafety";
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();

  const phase = $derived(
    session.active?.conflict
      ? "conflict"
      : (session.active?.savePhase ?? "saved"),
  );
  const pathLabel = $derived(
    session.active ? session.tabLabel(session.active) : "",
  );
</script>

<footer class="status-bar">
  <p class="save-slot" data-phase={phase} role="status">
    <span class="save-dot"></span>
    <span class="save-word">{session.saveStateLabel}</span>
  </p>
  <p class="status-path" title={session.active?.key ?? ""}>{pathLabel}</p>
  <span class="sr-only">
    {#if showsSource(session.viewMode)}
      {session.labels.editor}
    {/if}
  </span>
</footer>
