import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Mycelium s'installe sur l'écran d'accueil et démarre sans réseau :
    // une idée arrive dans le métro, pas devant un bureau connecté.
    //
    // Le service worker ne met en cache que la coque de l'app — code,
    // styles, polices. Les Elements continuent de passer par le réseau
    // pour l'instant : les garder hors ligne demande une file d'écritures
    // et un cache de données, qui viendront séparément.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2'],
      manifest: {
        name: 'Mycelium',
        short_name: 'Mycelium',
        lang: 'fr',
        description: "L'univers de ton récit, un seul type d'objet.",
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        // Une icône vectorielle plutôt qu'une série de PNG : elle reste
        // nette à toutes les tailles, et il n'y a qu'un fichier à tenir à
        // jour quand la marque change. `any maskable` couvre à la fois les
        // systèmes qui découpent l'icône et ceux qui la posent telle
        // quelle — le dessin garde sa marge pour les deux.
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // L'app est une SPA : toute adresse inconnue rend index.html, sinon
        // rouvrir l'app installée sur /elements/<id> donnerait une page
        // blanche hors réseau.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Les images envoyées sont immuables : une fois vues, elles
            // n'ont plus besoin du réseau.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mycelium-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
