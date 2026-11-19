import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? "/",
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      disable: mode === "demo",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        id: "/",
        name: "Técnica Engenharia — Gestão de Obras",
        short_name: "Técnica",
        description: "Gestão de obras, RDO, orçamentos, laudos e vistorias da Técnica Engenharia.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#0A0D12",
        background_color: "#0A0D12",
        categories: ["business", "productivity"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Novo RDO", url: "/obras?acao=rdo", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Agenda", url: "/agenda", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Só assets versionados vão para o cache. Dados (Supabase) sempre da rede.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//, /^\/storage\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          pdf: ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
}));
