import { mount } from "svelte";

import App from "./App.svelte";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/fonts.css";
import "./app.css";
import "./styles/ui.css";
import "./styles/editor.css";
import {
  applyDocumentTheme,
  asPageColor,
  asTheme,
  type StartupAppearance,
} from "./lib/appearance";
import { DEFAULT_RENDER_FONT, DEFAULT_SOURCE_FONT } from "./lib/fonts";
import { api } from "./lib/api";
import { initLocale } from "./lib/locale";

async function start() {
  let locale = "pl";
  let startup: StartupAppearance;
  try {
    const settings = await api.getSettings();
    locale = settings.locale;
    startup = {
      theme: asTheme(settings.theme),
      pageColor: asPageColor(settings.page_color),
      sourceFont: settings.source_font || DEFAULT_SOURCE_FONT,
      renderFont: settings.render_font || DEFAULT_RENDER_FONT,
      error: "",
    };
    applyDocumentTheme(startup.theme);
  } catch (error) {
    startup = {
      theme: "system",
      pageColor: "white",
      sourceFont: DEFAULT_SOURCE_FONT,
      renderFont: DEFAULT_RENDER_FONT,
      error: String(error),
    };
  }
  initLocale(locale);
  const target = document.getElementById("app");
  if (!target) throw new Error("app root is missing");
  mount(App, { target, props: { startup } });
}

void start();
