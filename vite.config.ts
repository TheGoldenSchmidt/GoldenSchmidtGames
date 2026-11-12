import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["gsg-icon.svg", "gsg-icon-192.png", "gsg-icon-512.png", "gsg-apple-touch-icon.png", "characters/*.png"],
      manifest: {
        id: "/",
        name: "GoldenSchmidtGames",
        short_name: "GSG",
        description: "Deine Sammlung für lokale und gemeinsame Spiele.",
        lang: "de-DE",
        categories: ["games", "entertainment"],
        theme_color: "#12172f",
        background_color: "#12172f",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/gsg-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/gsg-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/gsg-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // Fonts are part of the offline app shell.
        globPatterns: ["**/*.{js,css,html,woff2}"],
        navigateFallback: "/index.html",
        skipWaiting: false,
        clientsClaim: true
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true
      },
      "/api": "http://localhost:3001"
    }
  }
});
