<script lang="ts">
  import { showsRendered, showsSource } from "../noteSafety";
  import Button from "../ui/Button.svelte";
  import StatusBar from "./StatusBar.svelte";
  import TabStrip from "./TabStrip.svelte";
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();
</script>

<div class="stage-body">
  <TabStrip {session} />

  {#if session.active?.conflict}
    <section class="conflict-banner" role="alert">
      <h2>{session.labels.saveStateConflict}</h2>
      <p>{session.labels.conflictBody}</p>
      {#if session.active.reloadArmed}
        <p>{session.labels.reloadWarning}</p>
      {/if}
      <div class="row-actions">
        {#if session.active.reloadArmed}
          <Button
            variant="danger"
            size="sm"
            label={session.labels.reloadConfirm}
            onclick={() => void session.reloadFromDisk()}
          />
          <Button
            variant="ghost"
            size="sm"
            label={session.labels.cancel}
            onclick={() => session.cancelReload()}
          />
        {:else}
          <Button
            variant="secondary"
            size="sm"
            label={session.labels.reloadDisk}
            onclick={() => session.requestReload()}
          />
          <Button
            variant="primary"
            size="sm"
            label={session.labels.overwriteDisk}
            onclick={() => void session.overwriteFromEditor()}
          />
        {/if}
      </div>
    </section>
  {/if}

  {#if session.active?.saveFailed && !session.active.conflict}
    <section class="conflict-banner" role="alert">
      <h2>{session.labels.saveFailed}</h2>
      <p>{session.labels.saveFailedBody}</p>
      <div class="row-actions">
        <Button
          variant="primary"
          size="sm"
          label={session.labels.retrySave}
          onclick={() => void session.saveActive()}
        />
        <Button
          variant="danger"
          size="sm"
          label={session.labels.leaveWithoutSaving}
          onclick={() => session.leaveWithoutSaving()}
        />
      </div>
    </section>
  {/if}

  <div class={["panes", session.viewMode]}>
    <section
      class="pane editor-pane"
      aria-label={session.labels.editor}
      hidden={!showsSource(session.viewMode)}
    >
      <div class="editor-host" {@attach session.attachEditor}></div>
    </section>
    <section
      class="pane preview-pane"
      aria-label={session.labels.preview}
      hidden={!showsRendered(session.viewMode)}
    >
      <div class="pages">
        {#each session.pageUrls as pageUrl, index (index)}
          <div class="page"><img src={pageUrl} alt="" /></div>
        {/each}
      </div>
      <div class="diagnostics" aria-label={session.labels.diagnostics}>
        <h3>{session.labels.diagnostics}</h3>
        {#if session.diagnostics.length === 0}
          <p class="muted">{session.labels.noDiagnostics}</p>
        {:else}
          <ul>
            {#each session.diagnostics as diagnostic, index (index)}
              <li>
                <button
                  type="button"
                  class={[
                    "diagnostic",
                    { error: diagnostic.severity === "error" },
                  ]}
                  onclick={() => session.jumpToDiagnostic(diagnostic)}
                >
                  <strong>{diagnostic.severity}</strong>
                  <span>{diagnostic.file}:{diagnostic.start}</span>
                  <span>{diagnostic.message}</span>
                  {#each diagnostic.hints as hint (hint)}
                    <span class="hint">{hint}</span>
                  {/each}
                </button>
              </li>
            {/each}
          </ul>
          {#if session.hasError && session.pageUrls.length > 0}
            <p class="muted">{session.labels.lastGoodKept}</p>
          {/if}
        {/if}
      </div>
    </section>
  </div>
  <StatusBar {session} />
</div>
