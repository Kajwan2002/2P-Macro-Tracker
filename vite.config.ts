import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// One codebase, one installable app. Two profiles (you + partner) live inside it
// and are switched in the UI. All data is local (IndexedDB). No backend.
//
// The deploy workflow sets VITE_BASE=/<repo-name>/ so GitHub Pages serves the
// app from a sub-path. Locally it defaults to "/".

const APP_NAME = 'Macro Tracker'
const SHORT_NAME = 'Macros'
const DESCRIPTION = 'Track daily calories and protein for two, split shared meals.'
const THEME_COLOR = '#0f1729'
const BG_COLOR = '#0f1729'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const base = env.VITE_BASE || '/'

  return {
    base,
    build: { outDir: 'dist', emptyOutDir: true },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          name: APP_NAME,
          short_name: SHORT_NAME,
          description: DESCRIPTION,
          theme_color: THEME_COLOR,
          background_color: BG_COLOR,
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
