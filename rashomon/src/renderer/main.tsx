import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@renderer/App";
import "@renderer/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Rashomon root container was not found.");
}

document.documentElement.classList.add("dark");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
