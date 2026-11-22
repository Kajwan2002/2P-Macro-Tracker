/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** build time (UTC) + commit, injected by vite.config.ts */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** base path, e.g. "/macro-tracker/" — set by the deploy workflow */
  readonly VITE_BASE?: string
}
