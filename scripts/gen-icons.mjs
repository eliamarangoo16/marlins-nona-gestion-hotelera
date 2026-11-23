// Genera los PNG de la PWA a partir de public/icon.svg (requiere sharp).
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const svg = await readFile(path.join(root, 'icon.svg'))

async function make(name, size, pad = 0) {
  const inner = Math.round(size * (1 - pad * 2))
  const img = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0f2a44' } })
    .composite([{ input: img, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
    .png()
    .toFile(path.join(root, name))
  console.log('ok', name)
}
await make('icon-192.png', 192)
await make('icon-512.png', 512)
await make('icon-512-maskable.png', 512, 0.12)
await make('apple-touch-icon.png', 180)
