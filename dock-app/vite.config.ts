import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5175,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
});
