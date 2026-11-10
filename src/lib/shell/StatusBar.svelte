<script lang="ts">
  import { showsSource } from "../noteSafety";
  import Button from "../ui/Button.svelte";
  import SegmentedControl from "../ui/SegmentedControl.svelte";
  import type { NoteView } from "../noteSafety";
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
  <SegmentedControl
    label={session.labels.viewSwitch}
    options={session.viewOptions}
    value={session.viewMode}
    onchange={(value) => session.setView(value as NoteView)}
  />
  <Button
    variant="ghost"
    size="sm"
    label={session.labels.saveNote}
    icon="save"
    onclick={() => void session.saveActive()}
  />
  <Button
    variant="ghost"
    size="sm"
    label={session.labels.exportPdf}
    icon="export"
    busy={session.exporting}
    disabled={!session.active || session.active.kind === "template"}
    onclick={() => void session.exportPdf()}
  />
  <span class="sr-only">
    {#if showsSource(session.viewMode)}
      {session.labels.editor}
    {/if}
  </span>
</footer>
