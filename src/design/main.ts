import { mount } from "svelte";

import "../styles/tokens.css";
import "../styles/base.css";
import Gallery from "./Gallery.svelte";

const target = document.getElementById("design");
if (!target) throw new Error("design root is missing");
mount(Gallery, { target });
