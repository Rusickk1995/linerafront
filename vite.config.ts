// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ВАЖНО:
//  - Никаких отдельных entrypoint'ов для @linera/client
//  - Никаких preserveEntrySignatures
//  - Никакого optimizeDeps.exclude для @linera/client
//  - Один алиас на browser-bundle (linera_web.js), как в доках.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@linera/client": "@linera/client/dist/linera_web.js",
    },
  },
});
