import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs separately; proxying keeps the client on one origin and avoids CORS in dev.
    proxy: {
      '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true },
    },
  },
});
