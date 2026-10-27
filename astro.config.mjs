// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://staramper.github.io',
  vite: {
    plugins: [tailwindcss()],
    // Three.js se carga con import() dinámico; su chunk es grande por naturaleza.
    build: { chunkSizeWarningLimit: 900 },
  },
});
