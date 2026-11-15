import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Spatium/',
  build: {
    rollupOptions: {
      output: { manualChunks: { supabase: ['@supabase/supabase-js'] } },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: 'Spatium',
        short_name: 'Spatium',
        description: 'A little space for everything on your mind.',
        theme_color: '#f7f8fa',
        background_color: '#f7f8fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/Spatium/',
        scope: '/Spatium/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
