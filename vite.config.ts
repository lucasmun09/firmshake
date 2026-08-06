/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy(),
    {
      name: 'inject-app-build-meta',
      transformIndexHtml(html) {
        const buildId = process.env.VITE_APP_BUILD_ID ?? Date.now().toString(36);
        return html.replace(
          '<meta http-equiv="Cache-Control" content="no-cache" />',
          `<meta http-equiv="Cache-Control" content="no-cache" />\n    <meta name="app-build" content="${buildId}" />`,
        );
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
