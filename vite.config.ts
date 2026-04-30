import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'motion-vendor':   ['framer-motion'],
          'ui-vendor':       ['lucide-react', 'zustand'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/favicon.svg', 'assets/icon.svg', 'assets/logo.svg'],
      manifest: {
        name: 'SUT — Sistema Universal de Tareas',
        short_name: 'SUT',
        description: 'Organiza tus tareas, cursos y calendario universitario',
        theme_color: '#4F6BFF',
        background_color: '#f6f7fb',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        lang: 'es',
        icons: [
          { src: 'assets/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Nueva tarea',
            short_name: 'Nueva tarea',
            description: 'Crear una nueva tarea rápidamente',
            url: './tasks?new=1',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
