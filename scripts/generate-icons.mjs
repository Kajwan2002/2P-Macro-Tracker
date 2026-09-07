// Rasterises the app icon into the PNG sizes the manifest + iOS need.
// A macro ring (mostly-full progress circle) on a dark navy tile.
// Run with: npm run icons
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

/** @param {number} k art scale (smaller = more padding, for maskable) */
function iconSvg(k) {
  const s = 512
  const c = s / 2
  const r = 150
  const stroke = 54
  const circ = 2 * Math.PI * r
  const pct = 0.72
  const dash = `${circ * pct} ${circ * (1 - pct)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b2740"/><stop offset="1" stop-color="#0f1729"/>
  </linearGradient></defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <g transform="translate(${c} ${c}) scale(${k}) translate(${-c} ${-c})">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#2a3552" stroke-width="${stroke}"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#37e0a8" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${c} ${c})"/>
    <text x="${c}" y="${c + 26}" font-family="-apple-system, Segoe UI, Roboto, sans-serif"
      font-size="120" font-weight="800" fill="#f4f7ff" text-anchor="middle">M</text>
  </g>
</svg>`
}

async function png(markup, size, file) {
  const buf = await sharp(Buffer.from(markup)).resize(size, size).png().toBuffer()
  await writeFile(file, buf)
  console.log('  ✓', file.replace(root + '\\', '').replace(root + '/', ''))
}

await mkdir(outDir, { recursive: true })
await png(iconSvg(1), 192, resolve(outDir, 'icon-192.png'))
await png(iconSvg(1), 512, resolve(outDir, 'icon-512.png'))
await png(iconSvg(0.66), 512, resolve(outDir, 'icon-maskable-512.png'))
await png(iconSvg(1), 180, resolve(root, 'public/apple-touch-icon.png'))
await writeFile(resolve(root, 'public/favicon.svg'), iconSvg(1))
console.log('  ✓ public/favicon.svg')
console.log('icons generated.')
