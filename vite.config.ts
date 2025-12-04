import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Конфиг под @linera/client (отдельный entrypoint и preserveEntrySignatures)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        linera: '@linera/client',
      },
      preserveEntrySignatures: 'strict',
    },
  },
  optimizeDeps: {
    // @linera/client и так сам себя соберет, не надо, чтобы Vite его "оптимизировал"
    exclude: ['@linera/client', 'lucide-react'],
  },
});
