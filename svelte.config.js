import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('svelte/compiler').PreprocessorGroup extends never ? import('@sveltejs/vite-plugin-svelte').SvelteConfig : import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
  preprocess: vitePreprocess(),
};

export default config;
