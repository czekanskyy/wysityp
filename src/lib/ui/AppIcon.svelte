<script lang="ts">
  // The WYSITyp app icon: a paper page with a heading being typed and a
  // caret. Brand colours are fixed, so it reads the same in every theme.
  let { size = 28 }: { size?: number } = $props();
</script>

<svg
  class="app-icon"
  viewBox="0 0 1024 1024"
  width={size}
  height={size}
  aria-hidden="true"
>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="#2a4fbf" />
  <path
    d="M252 168 H624 L800 344 V812 A52 52 0 0 1 748 864 H252 A52 52 0 0 1 200 812 V220 A52 52 0 0 1 252 168 Z"
    fill="#fffdf9"
  />
  <path d="M624 168 L800 344 H676 A52 52 0 0 1 624 292 Z" fill="#c3cff0" />
  <rect x="288" y="428" width="240" height="124" rx="62" fill="#2a4fbf" />
  <rect x="568" y="380" width="76" height="220" rx="38" fill="#7c3aad" />
  <rect x="288" y="684" width="424" height="80" rx="40" fill="#2a4fbf" />
</svg>

<style>
  .app-icon {
    display: block;
    flex: none;
  }
</style>
