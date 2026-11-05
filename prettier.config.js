/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-svelte"],
  // Keep the line endings already in each file. Windows checkouts use
  // CRLF, and forcing LF makes `format:check` fail on those trees.
  endOfLine: "auto",
  overrides: [
    {
      files: "*.svelte",
      options: { parser: "svelte" },
    },
  ],
};
