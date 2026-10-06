import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMessagingServiceWorker } from "./scripts/messaging-sw.mjs";

function firebaseMessagingSwPlugin(env) {
  const body = () => buildMessagingServiceWorker(env);

  return {
    name: "firebase-messaging-sw",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/firebase-messaging-sw.js") {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(body());
      });
    },
    async writeBundle(options) {
      const outDir = options.dir || resolve("dist");
      await writeFile(resolve(outDir, "firebase-messaging-sw.js"), body(), "utf8");
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      firebaseMessagingSwPlugin(env),
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
  };
});
