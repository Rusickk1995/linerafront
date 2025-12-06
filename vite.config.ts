// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Никаких alias к @linera/client, используем пакет как есть.
export default defineConfig({
  plugins: [react()],
});
