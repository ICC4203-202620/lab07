import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Deja la lista de archivos generados, con sus nombres definitivos (que
    // incluyen un hash del contenido), en dist/assets-manifest.json. El
    // service worker la lee al instalarse para precachear el bundle.
    manifest: 'assets-manifest.json',
  },
})
