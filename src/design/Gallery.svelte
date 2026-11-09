<script lang="ts">
  // Dev only gallery of the design system. The words here are sample
  // content in both languages, not app strings, so they live in this file
  // and not in messages/*.json.
  import {
    Button,
    Card,
    CommandPalette,
    Icon,
    IconButton,
    Kbd,
    Menu,
    MenuButton,
    SegmentedControl,
    Sidebar,
    SidebarSection,
    Tag,
    TextField,
    Toolbar,
    ToolbarSeparator,
    Tree,
    TreeItem,
    theme,
    type Command,
    type MenuEntry,
    type ThemeChoice,
  } from "../lib/ui";
  import { sample, type SampleLocale } from "./sample";

  let lang = $state<SampleLocale>("pl");
  let themeChoice = $state<ThemeChoice>("system");
  let paletteOpen = $state(false);
  let view = $state<"split" | "source" | "rendered">("rendered");
  let bold = $state(true);
  let italic = $state(false);
  let search = $state("");
  let noteName = $state("wyklad-07");
  let open = $state<Record<string, boolean>>({ analiza: true, fizyka: false });
  let activeNote = $state("analiza/wyklad-07");
  let filter = $state<string | null>(null);
  let lastAction = $state("");

  const t = $derived(sample[lang]);

  $effect(() => theme.apply(themeChoice));
  $effect(() => {
    document.documentElement.lang = lang;
  });

  const commands = $derived<Command[]>([
    {
      id: "new",
      group: t.groupNotes,
      icon: "plus",
      title: t.cmdNew,
      shortcut: ["Ctrl", "N"],
      keywords: ["new note", "nowa"],
      run: () => (lastAction = t.cmdNew),
    },
    {
      id: "open",
      group: t.groupNotes,
      icon: "search",
      title: t.cmdOpen,
      shortcut: ["Ctrl", "P"],
      keywords: ["open", "otwórz"],
      run: () => (lastAction = t.cmdOpen),
    },
    {
      id: "pdf",
      group: t.groupNotes,
      icon: "download",
      title: t.cmdPdf,
      shortcut: ["Ctrl", "E"],
      keywords: ["export", "eksport"],
      run: () => (lastAction = t.cmdPdf),
    },
    {
      id: "math",
      group: t.groupInsert,
      icon: "math",
      title: t.cmdMath,
      shortcut: ["Ctrl", "M"],
      keywords: ["math", "equation", "wzór"],
      run: () => (lastAction = t.cmdMath),
    },
    {
      id: "table",
      group: t.groupInsert,
      icon: "table",
      title: t.cmdTable,
      keywords: ["table", "tabela"],
      run: () => (lastAction = t.cmdTable),
    },
    {
      id: "code",
      group: t.groupInsert,
      icon: "code",
      title: t.cmdCode,
      keywords: ["code", "kod"],
      run: () => (lastAction = t.cmdCode),
    },
    {
      id: "source",
      group: t.groupView,
      icon: "columns",
      title: t.cmdSource,
      shortcut: ["Ctrl", "/"],
      keywords: ["source", "źródło"],
      run: () => (view = "source"),
    },
    {
      id: "theme",
      group: t.groupView,
      icon: "moon",
      title: t.cmdTheme,
      keywords: ["dark", "light", "ciemny", "jasny"],
      run: () => (themeChoice = themeChoice === "dark" ? "light" : "dark"),
    },
  ]);

  const rowMenu = $derived<MenuEntry[]>([
    {
      id: "rename",
      label: t.rename,
      icon: "pencil",
      shortcut: "F2",
      onselect: () => (lastAction = t.rename),
    },
    {
      id: "move",
      label: t.move,
      icon: "folder",
      onselect: () => (lastAction = t.move),
    },
    { separator: true },
    {
      id: "delete",
      label: t.delete,
      icon: "trash",
      danger: true,
      onselect: () => (lastAction = t.delete),
    },
  ]);

  const colorGroups = [
    {
      name: "Surfaces",
      tokens: ["bg", "surface", "surface-raised", "surface-sunken"],
    },
    {
      name: "Text & lines",
      tokens: ["text", "text-muted", "text-faint", "border", "border-strong"],
    },
    {
      name: "Accent",
      tokens: ["accent", "accent-soft", "accent-soft-text", "selection"],
    },
    {
      name: "Status",
      tokens: [
        "danger",
        "danger-soft",
        "warning",
        "warning-soft",
        "success",
        "success-soft",
      ],
    },
    {
      name: "Content",
      tokens: ["math", "math-soft", "code-text", "highlight", "markup"],
    },
  ];
  const tagColors = [
    "gray",
    "blue",
    "green",
    "amber",
    "red",
    "violet",
    "teal",
  ] as const;
  const radii = ["xs", "sm", "md", "lg", "xl"];
  const shadows = ["xs", "sm", "md", "lg"];
  const spaces = ["1", "2", "3", "4", "6", "8", "12"];

  function onGlobalKey(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      paletteOpen = true;
    }
  }
</script>

<svelte:window onkeydown={onGlobalKey} />

<div class="page">
  <header class="masthead">
    <div>
      <h1>WYSITyp <span>· Papier</span></h1>
      <p>{t.intro}</p>
    </div>
    <div class="switches">
      <SegmentedControl
        label="Language"
        bind:value={lang}
        options={[
          { value: "pl", label: "Polski" },
          { value: "en", label: "English" },
        ]}
      />
      <SegmentedControl
        label="Theme"
        bind:value={themeChoice}
        options={[
          { value: "system", label: t.system },
          { value: "light", label: t.light, icon: "sun", iconOnly: true },
          { value: "dark", label: t.dark, icon: "moon", iconOnly: true },
        ]}
      />
    </div>
  </header>

  <!-- ===================== App shell ===================== -->
  <section class="block">
    <h2>{t.shell}</h2>
    <p class="lead">{t.shellLead} <Kbd keys={["Ctrl", "K"]} /></p>
    <div class="shell">
      <Sidebar label={t.notes}>
        {#snippet header()}
          <div class="ws">
            <span class="ws-mark">W</span>
            <span class="ws-name">{t.workspace}</span>
            <IconButton
              icon="plus"
              label={t.cmdNew}
              shortcut="Ctrl+N"
              size="sm"
            />
          </div>
          <button
            type="button"
            class="search-trigger"
            onclick={() => (paletteOpen = true)}
          >
            <Icon name="search" size="sm" />
            <span>{t.searchShort}</span>
            <Kbd keys={["Ctrl", "K"]} />
          </button>
        {/snippet}

        <SidebarSection title={t.recent}>
          <Tree label={t.recent}>
            <TreeItem
              kind="note"
              label={t.note1}
              active={activeNote === "analiza/wyklad-07"}
              onselect={() => (activeNote = "analiza/wyklad-07")}
            />
            <TreeItem
              kind="note"
              label={t.note3}
              active={activeNote === "fizyka/lab-02"}
              onselect={() => (activeNote = "fizyka/lab-02")}
            />
          </Tree>
        </SidebarSection>

        <SidebarSection title={t.notes}>
          {#snippet actions()}
            <IconButton icon="plus" label={t.newFolder} size="sm" />
          {/snippet}
          <Tree label={t.notes}>
            <TreeItem
              kind="folder"
              label={t.folder1}
              expanded={open.analiza}
              ontoggle={(v) => (open.analiza = v)}
            >
              <TreeItem
                kind="note"
                level={2}
                label={t.note1}
                badge="●"
                active={activeNote === "analiza/wyklad-07"}
                onselect={() => (activeNote = "analiza/wyklad-07")}
              >
                {#snippet actions()}
                  <MenuButton label={t.more} entries={rowMenu} align="end" />
                {/snippet}
              </TreeItem>
              <TreeItem
                kind="note"
                level={2}
                label={t.note2}
                active={activeNote === "analiza/cwiczenia-03"}
                onselect={() => (activeNote = "analiza/cwiczenia-03")}
              />
            </TreeItem>
            <TreeItem
              kind="folder"
              label={t.folder2}
              expanded={open.fizyka}
              ontoggle={(v) => (open.fizyka = v)}
            >
              <TreeItem
                kind="note"
                level={2}
                label={t.note3}
                active={activeNote === "fizyka/lab-02"}
                onselect={() => (activeNote = "fizyka/lab-02")}
              />
            </TreeItem>
            <TreeItem
              kind="note"
              label={t.note4}
              active={activeNote === "plan"}
              onselect={() => (activeNote = "plan")}
            />
          </Tree>
        </SidebarSection>

        {#snippet footer()}
          <IconButton icon="settings" label={t.settings} size="sm" />
          <IconButton
            icon={themeChoice === "dark" ? "sun" : "moon"}
            label={t.cmdTheme}
            size="sm"
            onclick={() =>
              (themeChoice = themeChoice === "dark" ? "light" : "dark")}
          />
          <span class="spacer"></span>
          <span class="save-dot">{t.saved}</span>
        {/snippet}
      </Sidebar>

      <div class="main">
        <div class="titlebar">
          <span class="crumbs"
            >{t.folder1}
            <Icon name="chevronRight" size="sm" />
            <strong>{t.note1}</strong></span
          >
          <span class="tags">
            <Tag color="blue">{t.tagCalc}</Tag>
            <Tag color="amber">{t.tagExam}</Tag>
          </span>
        </div>
        <Toolbar label={t.formatting}>
          <IconButton icon="undo" label={t.undo} shortcut="Ctrl+Z" size="sm" />
          <IconButton icon="redo" label={t.redo} shortcut="Ctrl+Y" size="sm" />
          <ToolbarSeparator />
          <IconButton icon="heading" label={t.heading} size="sm" />
          <IconButton
            icon="bold"
            label={t.bold}
            shortcut="Ctrl+B"
            size="sm"
            pressed={bold}
            onclick={() => (bold = !bold)}
          />
          <IconButton
            icon="italic"
            label={t.italic}
            shortcut="Ctrl+I"
            size="sm"
            pressed={italic}
            onclick={() => (italic = !italic)}
          />
          <IconButton icon="strike" label={t.strike} size="sm" />
          <ToolbarSeparator />
          <IconButton icon="list" label={t.list} size="sm" />
          <IconButton icon="listOrdered" label={t.listOrdered} size="sm" />
          <IconButton icon="quote" label={t.quote} size="sm" />
          <ToolbarSeparator />
          <IconButton
            icon="math"
            label={t.mathInline}
            shortcut="Ctrl+M"
            size="sm"
          />
          <IconButton
            icon="mathBlock"
            label={t.mathBlock}
            shortcut="Ctrl+Shift+M"
            size="sm"
          />
          <IconButton icon="code" label={t.code} size="sm" />
          <IconButton icon="link" label={t.link} shortcut="Ctrl+K" size="sm" />
          <IconButton icon="table" label={t.table} size="sm" />
          <IconButton icon="image" label={t.image} size="sm" />
          {#snippet end()}
            <SegmentedControl
              label={t.view}
              bind:value={view}
              options={[
                {
                  value: "source",
                  label: t.viewSource,
                  icon: "code",
                  iconOnly: true,
                },
                {
                  value: "split",
                  label: t.viewSplit,
                  icon: "columns",
                  iconOnly: true,
                },
                {
                  value: "rendered",
                  label: t.viewRendered,
                  icon: "eye",
                  iconOnly: true,
                },
              ]}
            />
          {/snippet}
        </Toolbar>

        <div class="paper">
          <article class="note-prose">
            <h1>{t.noteTitle}</h1>
            <p>
              {t.noteP1a} <strong>{t.noteStrong}</strong>
              {t.noteP1b} <span class="note-math-inline">f : [a, b] → ℝ</span>
              {t.noteP1c}
            </p>
            <span class="note-math-block"
              >∫<sub>a</sub><sup>b</sup> f(x) dx = F(b) − F(a)</span
            >
            <p>
              {t.noteP2}
              <span class="note-math-source">$integral_a^b f(x) dif x$</span>
            </p>
            <ul>
              <li>{t.li1} <span class="note-math-inline">F′ = f</span>,</li>
              <li>{t.li2} <mark>{t.liMark}</mark>.</li>
            </ul>
            <blockquote>{t.quoteText}</blockquote>
            <p>{t.codeLead} <code>integrate()</code>:</p>
            <pre><code
                >def integrate(f, a, b, n=1000):
    h = (b - a) / n
    return h * sum(f(a + i * h) for i in range(n))</code
              ></pre>
            <p>
              <span class="note-error">$x^2 +$</span>
              <span class="muted">← {t.errorHint}</span>
            </p>
          </article>
        </div>
      </div>
    </div>
    {#if lastAction}<p class="lead">
        {t.lastAction}: <strong>{lastAction}</strong>
      </p>{/if}
  </section>

  <!-- ===================== Colour ===================== -->
  <section class="block">
    <h2>{t.colour}</h2>
    {#each colorGroups as group (group.name)}
      <h3>{group.name}</h3>
      <div class="swatches">
        {#each group.tokens as token (token)}
          <div class="swatch">
            <span class="chip" style:background="var(--color-{token})"></span>
            <code>--color-{token}</code>
          </div>
        {/each}
      </div>
    {/each}
    <h3>Tags</h3>
    <div class="row">
      {#each tagColors as color (color)}
        <Tag {color}>{color}</Tag>
      {/each}
    </div>
  </section>

  <!-- ===================== Type ===================== -->
  <section class="block">
    <h2>{t.type}</h2>
    <div class="type-grid">
      <div class="type-card">
        <span class="type-label">--font-ui · Segoe UI Variable</span>
        <p class="ui-sample">{t.pangram}</p>
      </div>
      <div class="type-card">
        <span class="type-label">--font-prose · Libertinus Serif / Cambria</span
        >
        <p class="prose-sample">{t.pangram}</p>
      </div>
      <div class="type-card">
        <span class="type-label"
          >--font-math · New Computer Modern Math / Cambria Math</span
        >
        <p class="math-sample">
          ∑<sub>n=1</sub><sup>∞</sup> 1/n² = π²/6 &nbsp; ∀ε &gt; 0 ∃δ &gt; 0
        </p>
      </div>
      <div class="type-card">
        <span class="type-label">--font-mono · Cascadia Mono / Consolas</span>
        <p class="mono-sample">#let f(x) = calc.pow(x, 2) // ąęłóźż</p>
      </div>
    </div>
    <h3>{t.noteScale}</h3>
    <div class="scale note-prose">
      <div style:font-size="var(--note-h1)" style:font-weight="700">
        H1 · 30 / {t.headingSample}
      </div>
      <div style:font-size="var(--note-h2)" style:font-weight="700">
        H2 · 24 / {t.headingSample}
      </div>
      <div style:font-size="var(--note-h3)" style:font-weight="700">
        H3 · 20 / {t.headingSample}
      </div>
      <div style:font-size="var(--note-text)">Body · 17 / {t.pangram}</div>
      <div style:font-size="var(--note-small)" class="muted">
        Small · 15 / {t.pangram}
      </div>
    </div>
    <h3>{t.uiScale}</h3>
    <div class="scale">
      <div style:font-size="var(--text-lg)">lg · 16 / {t.pangram}</div>
      <div style:font-size="var(--text-md)">md · 14 / {t.pangram}</div>
      <div style:font-size="var(--text-sm)">sm · 13 / {t.pangram}</div>
      <div style:font-size="var(--text-xs)">xs · 12 / {t.pangram}</div>
    </div>
  </section>

  <!-- ===================== Space, radius, shadow ===================== -->
  <section class="block">
    <h2>{t.shape}</h2>
    <div class="row wrap">
      {#each spaces as s (s)}
        <div class="space">
          <span style:width="var(--space-{s})"></span><code>--space-{s}</code>
        </div>
      {/each}
    </div>
    <div class="row wrap">
      {#each radii as r (r)}
        <div class="radius" style:border-radius="var(--radius-{r})">
          <code>--radius-{r}</code>
        </div>
      {/each}
    </div>
    <div class="row wrap">
      {#each shadows as s (s)}
        <div class="shadow" style:box-shadow="var(--shadow-{s})">
          <code>--shadow-{s}</code>
        </div>
      {/each}
    </div>
  </section>

  <!-- ===================== Components ===================== -->
  <section class="block">
    <h2>{t.components}</h2>

    <h3>Button</h3>
    <div class="row wrap">
      <Button variant="primary" icon="save">{t.save}</Button>
      <Button icon="folderOpen">{t.openFolder}</Button>
      <Button variant="ghost" icon="download">{t.cmdPdf}</Button>
      <Button variant="danger" icon="trash">{t.delete}</Button>
      <Button busy>{t.exporting}</Button>
      <Button disabled>{t.disabled}</Button>
      <Button size="sm" icon="plus">{t.cmdNew}</Button>
    </div>

    <h3>IconButton · Kbd</h3>
    <div class="row wrap">
      <IconButton
        icon="bold"
        label={t.bold}
        shortcut="Ctrl+B"
        pressed={bold}
        onclick={() => (bold = !bold)}
      />
      <IconButton icon="italic" label={t.italic} shortcut="Ctrl+I" />
      <IconButton icon="sidebar" label={t.sidebar} />
      <IconButton icon="settings" label={t.settings} disabled />
      <Kbd keys={["Ctrl", "Shift", "P"]} />
      <Kbd keys={["F2"]} />
    </div>

    <h3>TextField</h3>
    <div class="fields">
      <TextField
        label={t.search}
        icon="search"
        placeholder={t.searchPlaceholder}
        bind:value={search}
        hideLabel
      />
      <TextField
        label={t.noteNameLabel}
        bind:value={noteName}
        hint={t.noteNameHint}
      />
      <TextField
        label={t.noteNameLabel}
        value="analiza/../x"
        error={t.noteNameError}
      />
    </div>

    <h3>Menu</h3>
    <div class="row top">
      <Menu label={t.more} entries={rowMenu} autofocus={false} />
      <MenuButton
        label={t.more}
        entries={rowMenu}
        text={t.actions}
        icon="more"
      />
    </div>

    <h3>Card</h3>
    <div class="cards">
      <Card
        icon="fileText"
        title={t.tplLecture}
        meta="lecture.typ"
        onclick={() => (lastAction = t.tplLecture)}
      >
        {t.tplLectureDesc}
      </Card>
      <Card
        icon="math"
        title={t.tplProblems}
        meta="problem-set.typ"
        onclick={() => (lastAction = t.tplProblems)}
      >
        {t.tplProblemsDesc}
      </Card>
      <Card
        title={t.note1}
        meta={t.note1Meta}
        onclick={() => (activeNote = "analiza/wyklad-07")}
      >
        {t.note1Snippet}
        {#snippet actions()}
          <MenuButton label={t.more} entries={rowMenu} align="end" />
        {/snippet}
      </Card>
    </div>

    <h3>Tag</h3>
    <div class="row wrap">
      {#each [["blue", t.tagCalc], ["green", t.tagPhysics], ["violet", t.tagAlgebra], ["amber", t.tagExam]] as [color, name] (name)}
        <Tag
          color={color as "blue"}
          selected={filter === name}
          onclick={() => (filter = filter === name ? null : name)}
        >
          {name}
        </Tag>
      {/each}
      <Tag
        color="red"
        onremove={() => (lastAction = t.removeTag)}
        removeLabel={t.removeTag}>{t.tagTodo}</Tag
      >
    </div>

    <h3>CommandPalette</h3>
    <Button icon="command" onclick={() => (paletteOpen = true)}
      >{t.openPalette}</Button
    >
  </section>
</div>

<CommandPalette
  bind:open={paletteOpen}
  {commands}
  label={t.palette}
  placeholder={t.palettePlaceholder}
  emptyText={t.paletteEmpty}
  hints={{ move: t.hintMove, run: t.hintRun, close: t.hintClose }}
/>

<style>
  .page {
    max-width: 76rem;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6) var(--space-16);
    font-size: var(--text-md);
  }

  .masthead {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: end;
    justify-content: space-between;
    margin-bottom: var(--space-8);
  }

  .masthead h1 {
    margin: 0;
    font-family: var(--font-prose);
    font-size: 2.25rem;
    letter-spacing: var(--tracking-tight);
  }

  .masthead h1 span {
    color: var(--color-text-muted);
    font-weight: var(--weight-regular);
  }

  .masthead p,
  .lead {
    margin: var(--space-1) 0 0;
    color: var(--color-text-muted);
    max-width: 48rem;
  }

  .switches {
    display: flex;
    gap: var(--space-2);
  }

  .block {
    margin-top: var(--space-12);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
  }

  h3 {
    margin: var(--space-6) 0 var(--space-2);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row.wrap {
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }

  .row.top {
    align-items: start;
    gap: var(--space-6);
  }

  .muted {
    color: var(--color-text-muted);
  }

  /* App shell */
  .shell {
    display: flex;
    height: 40rem;
    margin-top: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    background: var(--color-surface);
  }

  .ws {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ws-mark {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-family: var(--font-prose);
    font-weight: var(--weight-bold);
  }

  .ws-name {
    flex: 1;
    font-weight: var(--weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-sm);
    padding: 0 var(--space-1-5) 0 var(--space-2);
    color: var(--color-text-faint);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .search-trigger span {
    flex: 1;
    text-align: left;
  }

  .search-trigger:hover {
    border-color: var(--color-border-strong);
  }

  .search-trigger:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .spacer {
    flex: 1;
  }

  .save-dot {
    font-size: var(--text-xs);
    color: var(--color-success);
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    height: var(--titlebar-height);
    padding: 0 var(--space-4);
    background: var(--color-surface);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .crumbs {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  .crumbs strong {
    color: var(--color-text);
    font-weight: var(--weight-medium);
  }

  .tags {
    display: flex;
    gap: var(--space-1);
  }

  .paper {
    flex: 1;
    overflow: auto;
    padding: var(--space-10) var(--space-8);
    background: var(--color-surface);
  }

  /* Swatches */
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-3);
  }

  .swatch {
    display: grid;
    gap: var(--space-1);
  }

  .swatch code,
  .space code,
  .radius code,
  .shadow code,
  .type-label {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--color-text-muted);
  }

  .chip {
    height: 3rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  /* Type */
  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    gap: var(--space-3);
  }

  .type-card {
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .type-card p {
    margin: var(--space-2) 0 0;
  }

  .ui-sample {
    font-size: var(--text-lg);
  }

  .prose-sample {
    font-family: var(--font-prose);
    font-size: var(--note-text);
  }

  .math-sample {
    font-family: var(--font-math);
    font-size: 1.25rem;
  }

  .mono-sample {
    font-family: var(--font-mono);
    font-size: var(--text-md);
    color: var(--color-code-text);
  }

  .scale {
    display: grid;
    gap: var(--space-2);
    max-width: none;
    margin: 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .scale > div {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Shape */
  .space {
    display: grid;
    gap: var(--space-1);
  }

  .space span {
    display: block;
    height: var(--space-4);
    background: var(--color-accent-soft);
    border: 1px solid var(--color-accent);
  }

  .radius,
  .shadow {
    display: grid;
    place-items: end start;
    width: 8rem;
    height: 5rem;
    padding: var(--space-2);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .shadow {
    border-color: transparent;
    border-radius: var(--radius-lg);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-3);
  }

  @media (max-width: 760px) {
    .shell :global(.sidebar) {
      display: none;
    }

    .paper {
      padding: var(--space-6) var(--space-4);
    }
  }
</style>
