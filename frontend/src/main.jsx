import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

registerSW({
  immediate: true,
  onNeedReload() {
    // A nova versão é instalada em segundo plano. Recarregar aqui faz a página
    // aberta atualizar de novo cerca de 2 segundos depois do refresh manual.
  }
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
