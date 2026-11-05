import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import process from "node:process";
import { defineConfig } from "vite";

// Tauri expects a fixed port and clear errors from the Rust side.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [paraglideVitePlugin({ project: "./project.inlang" }), svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
