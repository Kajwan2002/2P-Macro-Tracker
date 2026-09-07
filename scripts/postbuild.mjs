// GitHub Pages serves static files only. A deep link (e.g. /history) 404s before
// the service worker is installed — copying index.html -> 404.html lets Pages
// fall back to the single-page app.
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const outDir = 'dist'
const index = join(outDir, 'index.html')

if (!existsSync(index)) {
  console.log(`  · ${index} not found, skipping 404`)
  process.exit(0)
}

copyFileSync(index, join(outDir, '404.html'))
console.log(`  ✓ ${outDir}/404.html`)
