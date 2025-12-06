// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Маппим @linera/client на реальный web-entry из твоей node_modules
      "@linera/client": "@linera/client/dist/linera.js",
    },
  },
  optimizeDeps: {
    // не трогаем @linera/client, пусть идёт как есть
    exclude: ["@linera/client"],
  },
});
