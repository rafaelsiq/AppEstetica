import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      selfDestroying: true,
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Gestão Clínica de Estética",
        short_name: "Estética",
        description: "Aplicação web para gestão de clientes, serviços e agenda.",
        theme_color: "#24695c",
        background_color: "#f5f6f8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ]
});
