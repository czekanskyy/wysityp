import { describe, expect, it } from "vitest";

import capabilityText from "../../src-tauri/capabilities/default.json?raw";
import html from "../../index.html?raw";
import confText from "../../src-tauri/tauri.conf.json?raw";

describe("release window config", () => {
  it("lets the page destroy the window it was asked to close", () => {
    // Tauri hands every close request to the page once it listens for it.
    // Without this permission the page's destroy() is refused in a release
    // build and the window can never be closed.
    const capability = JSON.parse(capabilityText);
    expect(capability.permissions).toContain("core:window:allow-destroy");
  });

  it("loads the startup guard as a plain script the CSP allows", () => {
    expect(html).toContain('<script src="/startup-guard.js"></script>');
    const conf = JSON.parse(confText);
    expect(conf.app.security.csp).toContain("script-src 'self'");
  });
});
