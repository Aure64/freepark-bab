import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        // MapLibre dans son propre chunk : téléchargement parallèle + il ne se
        // re-télécharge pas quand seul le code applicatif change
        advancedChunks: {
          groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // defer : l'enregistrement du service worker ne bloque plus le premier rendu
      injectRegister: 'script-defer',
      includeAssets: [
        'icons/icon.svg',
        'icons/apple-touch-icon.png',
        'data/zones.geojson',
        'data/streets.json',
      ],
      manifest: {
        name: 'FreePark BAB — stationnement gratuit',
        short_name: 'FreePark BAB',
        description:
          "Le stationnement gratuit à Biarritz, Anglet et Bayonne, selon l'heure où vous y allez.",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#faf9f5',
        theme_color: '#faf9f5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,geojson,json}'],
        globIgnores: ['**/*.map'],
        // Tuiles de carte : cache au fil de l'eau, plafonné
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/api-adresse\.data\.gouv\.fr\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'geocoding', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
});
