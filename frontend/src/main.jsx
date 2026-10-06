import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import ClientPortal from "./ClientPortal";
import OpenInstalledApp from "./OpenInstalledApp";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/c/:token" element={<ClientPortal />} />
        <Route path="/abrir-acompanhamento" element={<OpenInstalledApp />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
