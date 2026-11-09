import { mount } from "svelte";

import App from "./App.svelte";
import "./styles/tokens.css";
import "./styles/base.css";
import "./app.css";
import "./styles/ui.css";
import {
  applyDocumentTheme,
  asPageColor,
  asTheme,
  type StartupAppearance,
} from "./lib/appearance";
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
      error: "",
    };
    applyDocumentTheme(startup.theme);
  } catch (error) {
    startup = {
      theme: "system",
      pageColor: "white",
      error: String(error),
    };
  }
  initLocale(locale);
  const target = document.getElementById("app");
  if (!target) throw new Error("app root is missing");
  mount(App, { target, props: { startup } });
}

void start();
