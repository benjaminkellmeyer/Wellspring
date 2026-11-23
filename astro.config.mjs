// Astro builds the pages; Express (server.js) serves the built site and the /api routes.
import { defineConfig } from 'astro/config';

export default defineConfig({
  // `npm run build` writes the finished site here. server.js serves this folder.
  outDir: './dist',
  // Build src/pages/login.astro as /login.html, so existing links like "/login.html" keep working.
  build: { format: 'file' },
  vite: {
    server: {
      // During `npm run dev`, send /api requests to the Express server on port 3000.
      proxy: { '/api': 'http://localhost:3000' },
    },
  },
});
