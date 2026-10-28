import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Miniatures dels blocs per al panell (spec §3.4): es capturen de la demo, amb el contingut sembrat, i
// s'escriuen directament als assets del paquet, que les serveix a `/_subur/blocks/<slug>.webp`.
// Cal la demo construïda i servida (`next start -p 3200`), mai un `dev` en marxa.

const baseURL = process.env.BASE_URL ?? 'http://localhost:3200'
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/core/assets/blocks')

const defaultTargets: Array<[string, string]> = [
  ['scrollHero', '/ca'],
  ['servicesGrid', '/ca'],
  ['note', '/ca'],
  ['featureList', '/ca'],
  ['testimonials', '/ca'],
  ['ctaBand', '/ca'],
  ['pageHero', '/ca/serveis'],
  ['statement', '/ca/serveis'],
  ['taskCatalog', '/ca/serveis'],
  ['faq', '/ca/serveis'],
  ['contact', '/ca/contacte'],
  // L'avís legal i no la privacitat: el seu bloc té paràgrafs i un títol, i la miniatura ho mostra.
  ['richTextSection', '/ca/avis-legal'],
]

// Arguments opcionals `<bloc>=<ruta>` (p. ex. `pnpm capture:blocks note=/ca/serveis`): si n'hi ha, només
// es capturen aquells blocs, a la ruta indicada. Sense arguments, es captura la llista sencera.
const overrides = new Map(
  process.argv.slice(2).map((arg) => {
    const [slug, route] = arg.split('=')
    if (!slug || !route) throw new Error(`Argument invàlid "${arg}": s'esperava <bloc>=<ruta>`)
    return [slug, route] as [string, string]
  }),
)

const targets: Array<[string, string]> = overrides.size > 0 ? [...overrides.entries()] : defaultTargets

const VIEWPORT = { height: 900, width: 1280 }
// Amplada fixa de la miniatura: amb 720 px (la mida de l'arrel), els blocs baixos de la demo (una nota,
// un text legal) quedarien per sota dels 160 px d'alçada que exigeix la prova del paquet.
const THUMB_WIDTH = 960
// Marge superior afegit a la captura (px de pantalla) dels blocs el contingut dels quals toca la vora de dalt:
// al pageHero, el marge intern del títol travessa el bloc cap a la capçalera i el títol queda a 6 px.
const PAD_TOP: Record<string, number> = { pageHero: 24 }
// Temps màxim per descodificar cada imatge del bloc: una que no arriba mai atura l'script amb un error.
const DECODE_TIMEOUT_MS = 10_000

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ reducedMotion: 'reduce', viewport: VIEWPORT })

// Bàner de consentiment: un perfil nou el mostra sempre. S'accepta pel `data-testid` de c15t a la primera
// pàgina, independent de l'idioma, perquè l'script no depengui dels textos del catàleg; la decisió queda
// desada al perfil per a la resta. Si no apareix, l'script falla: vol dir que el
// selector ha canviat i les captures en podrien quedar tapades.
const bannerRoot = page.locator('[data-testid="consent-banner-root"]')
await page.goto(`${baseURL}${targets[0][1]}`, { waitUntil: 'load' })
await bannerRoot.waitFor({ state: 'visible', timeout: 10_000 })
await page.locator('[data-testid="consent-banner-accept-button"]').click()
await bannerRoot.waitFor({ state: 'hidden' })

// Sense `networkidle`: a `next start`, alguna precàrrega RSC dels enllaços (`?_rsc=`) de vegades queda
// oberta i la xarxa no arriba mai a reposar. N'hi ha prou amb `load`, les fonts i les imatges del bloc.
for (const [slug, route] of targets) {
  const res = await page.goto(`${baseURL}${route}`, { waitUntil: 'load' })
  if (!res?.ok()) throw new Error(`${route}: resposta ${res?.status()}`)
  await page.addStyleTag({
    content: '[data-site-header]{position:static !important} nextjs-portal{display:none !important}',
  })
  const block = page.locator(`[data-block="${slug}"]`).first()
  await block.scrollIntoViewIfNeeded()
  // Les imatges diferides comencen a carregar en entrar a la vista: s'espera que totes siguin a punt.
  await page.evaluate(() => document.fonts.ready)
  await block.evaluate(
    (el, ms) =>
      Promise.all(
        [...el.querySelectorAll('img')].map((img) =>
          Promise.race([
            img.decode().catch(() => {
              throw new Error(`la imatge ${img.currentSrc || img.src} no es pot descodificar`)
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`la imatge ${img.currentSrc || img.src} no s'ha descodificat en ${ms} ms`)), ms),
            ),
          ]),
        ),
      ),
    DECODE_TIMEOUT_MS,
  )
  // El bàner de c15t es munta al client després de la hidratació: just abans de capturar se li dona un
  // marge curt per aparèixer, i s'espera que no ho faci. Si torna, l'script falla abans de la captura.
  await bannerRoot.waitFor({ state: 'visible', timeout: 1_500 }).then(
    () => {
      throw new Error(`${route}: el bàner de consentiment ha tornat abans de capturar ${slug}`)
    },
    () => {},
  )
  const shot = await block.screenshot()
  const { height = 0, width = 0 } = await sharp(shot).metadata()
  // Un bloc més alt que la pantalla (el scrollHero, amb la pista del desplaçament) es retalla a la primera
  // pantalla: és el que se'n veu en arribar-hi, i la miniatura conserva una proporció llegible. El marge
  // superior (PAD_TOP) es pinta amb el color de la superfície, pres del píxel de dalt a l'esquerra.
  const [r = 0, g = 0, b = 0] = await sharp(shot).extract({ height: 1, left: 0, top: 0, width: 1 }).raw().toBuffer()
  const framed = await sharp(shot)
    .extract({ height: Math.min(height, VIEWPORT.height), left: 0, top: 0, width })
    .toBuffer()
    .then((buf) => sharp(buf).extend({ background: { b, g, r }, top: PAD_TOP[slug] ?? 0 }).toBuffer())
  const webp = path.join(outDir, `${slug}.webp`)
  await sharp(framed).resize({ width: THUMB_WIDTH }).webp({ quality: 80 }).toFile(webp)
  console.log(`✓ ${path.relative(process.cwd(), webp)}`)
}

await browser.close()
