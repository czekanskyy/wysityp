import { mount } from "svelte";

import App from "./App.svelte";
import "./styles/tokens.css";
import "./styles/base.css";
import "./app.css";
import "./styles/ui.css";
import { api } from "./lib/api";
import { initLocale } from "./lib/locale";

async function start() {
  let locale = "pl";
  try {
    const settings = await api.getSettings();
    locale = settings.locale;
  } catch {
    // In a plain browser there is no Rust side. Polish stays the start.
  }
  initLocale(locale);
  const target = document.getElementById("app");
  if (!target) throw new Error("app root is missing");
  mount(App, { target });
}

void start();
