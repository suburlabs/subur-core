import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const PALETTES: Record<string, [string, string, string]> = {
  'hero-workshop': ['#16201b', '#1f5a3d', '#e3e7e1'], 'hero-kitchen': ['#7a4b1e', '#d9a441', '#f4f3ef'],
  'hero-bath': ['#1d4d5c', '#6fae8b', '#e3e7e1'], 'hero-done': ['#f4f3ef', '#c9d6cc', '#1f5a3d'],
  'service-kitchen': ['#d9a441', '#7a4b1e', '#f4f3ef'], 'service-bath': ['#1d4d5c', '#5f9fb4', '#f4f3ef'],
  'service-repairs': ['#4a4f4c', '#9aa39d', '#f4f3ef'], 'page-services': ['#1f5a3d', '#8fcfaa', '#f4f3ef'],
  'page-contact': ['#e3e7e1', '#1f5a3d', '#16201b'],
}
const HEROES = ['hero-workshop', 'hero-kitchen', 'hero-bath', 'hero-done']

/** Tots els fitxers que aquest script escriu: la demo no en versiona cap altre (ruling P13). */
export const OUTPUTS: readonly string[] = [
  ...Object.keys(PALETTES).map((name) => `src/site/seed/media/${name}.webp`),
  ...HEROES.map((_, i) => `public/site/hero/poster-${i + 1}.webp`),
  'public/site/hero/film.mp4',
  'public/site/hero/film-m.mp4',
  'public/site/og-default.webp',
  'public/site/logo-mark.svg',
  'public/site/logo-lockup.webp',
]

const svg = (w: number, h: number, [a, b, c]: [string, string, string], seed: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="${(seed * 97) % (w / 2)}" y="${h / 5}" width="${w / 3}" height="${h / 2}" fill="${c}" opacity="0.55"/>
  <circle cx="${w - ((seed * 131) % (w / 3)) - w / 6}" cy="${h / 2}" r="${h / 4}" fill="${a}" opacity="0.6"/>
</svg>`

async function main() {
  // Els camins de sortida (els d'OUTPUTS) són relatius a l'arrel de la demo, sigui quin sigui el directori des d'on es crida.
  process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
  mkdirSync('src/site/seed/media', { recursive: true })
  mkdirSync('public/site/hero', { recursive: true })
  let seed = 1
  for (const [name, palette] of Object.entries(PALETTES)) await sharp(Buffer.from(svg(1600, 1000, palette, seed++))).webp({ quality: 82 }).toFile(`src/site/seed/media/${name}.webp`)
  for (const [i, name] of HEROES.entries()) await sharp(Buffer.from(svg(1280, 720, PALETTES[name], i + 11))).webp({ quality: 82 }).toFile(`public/site/hero/poster-${i + 1}.webp`)
  await sharp(Buffer.from(svg(1200, 630, PALETTES['page-services'], 21))).webp().toFile('public/site/og-default.webp')
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#1f5a3d"/><path d="M14 46 L32 18 L50 46 Z" fill="#f4f3ef"/></svg>`
  writeFileSync('public/site/logo-mark.svg', `${mark}\n`)
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"><g transform="translate(0,16) scale(2)">${mark.replace(/<\/?svg[^>]*>/g, '')}</g><rect x="160" y="64" width="440" height="32" rx="4" fill="#1f5a3d"/></svg>`)).webp().toFile('public/site/logo-lockup.webp')
  // El film: els quatre pòsters encadenats (ffmpeg del sistema, no és cap dependència npm). La llargada és fixa:
  // 194 fotogrames a 24 fps = 8,083 s, la `duration` de site.config.ts.
  const inputs = [1, 2, 3, 4].flatMap((n) => ['-loop', '1', '-t', '2', '-i', `public/site/hero/poster-${n}.webp`])
  const concat = '[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0,format=yuv420p[v]'
  execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', concat, '-map', '[v]', '-r', '24', '-frames:v', '194', '-movflags', '+faststart', 'public/site/hero/film.mp4'], { stdio: 'inherit' })
  execFileSync('ffmpeg', ['-y', '-i', 'public/site/hero/film.mp4', '-vf', 'scale=640:-2', '-frames:v', '194', '-movflags', '+faststart', 'public/site/hero/film-m.mp4'], { stdio: 'inherit' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
