import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le même proxy /api + /ws est nécessaire en `vite dev` (server.proxy) et en
// `vite preview` (preview.proxy, testé via `vite build && vite preview` pour
// le mode hors-ligne PWA, cf. README) — Vite ne partage pas la config entre
// les deux, d'où la duplication factorisée ici.
const proxy = {
  "/api": {
    target: "http://localhost:4000",
    changeOrigin: true,
  },
  "/ws": {
    target: "ws://localhost:4000",
    ws: true,
  },
  // Photos produit téléversées directement (cf. backend routes/products.js,
  // servi en statique par le backend) — même besoin de proxy que /api.
  "/uploads": {
    target: "http://localhost:4000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
