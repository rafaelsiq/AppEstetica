import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      selfDestroying: false,
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "manifest-cliente.webmanifest"],
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
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ]
});
