import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Les pàgines de la demo en l'idioma per defecte (ca) i la portada dels altres dos idiomes.
const paths = [
  '/ca',
  '/ca/serveis',
  '/ca/contacte',
  '/ca/avis-legal',
  '/ca/privacitat',
  '/ca/cookies',
  '/es',
  '/en',
  '/ca/no-existe',
]

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

// Next 16 solo sirve el boundary de `notFound()` dentro del payload de RSC:
// el HTML inicial de una ruta dinámica que termina en `notFound()` no lleva
// `lang`, ni `<title>`, ni texto (defecto confirmado del framework, no de
// este componente; vercel/next.js#98295, cerrado por falta de reproducción
// pero sin corregir). El código de estado 404 es correcto y la página se
// renderiza en cuanto corre el JavaScript del cliente. Reevaluar cuando se
// actualice Next.js.
const KNOWN_BROKEN_PATHS = new Set(['/ca/no-existe'])

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad (${colorScheme})`, () => {
    for (const path of paths) {
      const run = KNOWN_BROKEN_PATHS.has(path) ? test.fixme : test
      run(`${path} cumple WCAG 2.2 AA`, async ({ browser }) => {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' })
        const page = await context.newPage()
        await page.goto(path)
        const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze()
        expect(
          violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`),
        ).toEqual([])
        await context.close()
      })
    }
  })
}

test('el hero con la película activa cumple WCAG 2.2 AA', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    viewport: { height: 900, width: 1440 },
  })
  const page = await context.newPage()

  // M5: s'analitzen els dos estats del film, `loading` (amb el seu indicador
  // al carril i `aria-busy`) i `playing`. El film de la demo és petit i
  // local: sense retenir-lo, `loading` durava menys que l'interval de
  // sondeig de l'assert (al CI, `null` → `playing` sense cap `loading` entre
  // mig) o canviava a `playing` a mitja anàlisi, i axe mesurava l'etiqueta
  // del carril a mig fos (`color-contrast`, ~1,1:1). Ara la petició del film
  // (`film.mp4` o `film-m.mp4`, segons l'amplada) queda retinguda fins que
  // la primera anàlisi acaba: `loading` és estable mentre dura, i només es
  // deixa passar després.
  let filmRequested = false
  let releaseFilm: () => void = () => {}
  const filmHeld = new Promise<void>((resolve) => {
    releaseFilm = resolve
  })
  await page.route('**/site/hero/film*.mp4', async (route) => {
    filmRequested = true
    await filmHeld
    await route.continue()
  })

  // Repòs: cap transició CSS finita en curs dins l'escenari (el fos de
  // l'etiqueta, el filet del carril, l'entrada del film). axe mesura colors
  // a l'instant i un element a mig fos dona contrastos que no existeixen.
  const transitionsSettled = () =>
    page.waitForFunction(() => {
      const stage = document.querySelector('[data-hero-stage]')
      if (!stage) return false
      return stage
        .getAnimations({ subtree: true })
        .every((animation) => animation.playState !== 'running' || animation.effect?.getComputedTiming().endTime === Infinity)
    })
  const describe = (violations: { id: string; nodes: { target: unknown[] }[] }[]) =>
    violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)

  await page.goto('/ca')
  const stage = page.locator('[data-hero-stage]')
  const loader = page.locator('.hero-rail__loader')

  // La ruta ha d'haver atrapat la baixada: si el film canviés de nom, el
  // test tornaria a dependre del temps sense avisar. Marge ampli: la
  // baixada només arrenca després de `load`, d'un moment ociós i del LCP
  // (o del seu temporitzador de seguretat de 2,5 s).
  await expect
    .poll(() => filmRequested, { message: 'la petició del film no ha passat per la ruta retinguda', timeout: 15_000 })
    .toBe(true)
  await expect(stage).toHaveAttribute('data-hero-state', 'loading')
  await expect(loader).toBeVisible()
  await expect.poll(() => loader.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  await transitionsSettled()
  const loading = await new AxeBuilder({ page }).include('[data-block="scrollHero"]').withTags(tags).analyze()
  // L'anàlisi s'ha fet de cap a cap en `loading` (el vigilant de 20 s no ha saltat).
  await expect(stage).toHaveAttribute('data-hero-state', 'loading')
  expect(describe(loading.violations)).toEqual([])

  releaseFilm()
  await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })
  // En entrar a `playing`, l'etiqueta de càrrega del carril se'n va amb un
  // fos de 300ms: analitzada a mig fos, axe la veia com text gairebé
  // transparent sobre el carril (contrast 1,04:1) i ho comptava com a
  // violació. S'espera que el fos acabi (`visibility: hidden` en repòs) i
  // que l'escenari quedi en repòs.
  await expect(loader).toBeHidden()
  await transitionsSettled()
  const { violations } = await new AxeBuilder({ page })
    .include('[data-block="scrollHero"]')
    .withTags(tags)
    .analyze()
  expect(describe(violations)).toEqual([])
  await context.close()
})

// Tarea 5: el bàner y el diálogo de consentimiento (c15t) deben cumplir las
// mismas etiquetas WCAG que el resto de la web, con el propio bàner o
// diálogo visible en el momento del análisis — es más cobertura, no menos,
// así que aquí no se descarta el consentimiento antes de analizar.
//
// Fix round 1: la primera versión usaba el fixture `page` por defecto (sin
// `colorScheme` ni `reducedMotion`), a diferencia del resto de este fichero.
// Sin `reducedMotion: 'reduce'`, `toBeVisible()` se cumple en cuanto la
// opacidad del diálogo deja el 0 — a mitad del fundido de entrada — y axe
// medía entonces un color a medio mezclar con el fondo (falso
// `color-contrast`, ~3.35:1 en vez de ~7:1 una vez asentado). Con
// `reducedMotion: 'reduce'` (misma opción que ya usa el bucle de arriba) no
// hay fundido y axe mide el color final. Se comprobó en el navegador antes
// de corregir: 0 violaciones en `light` y en `dark`, con y sin diálogo.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`el bàner de cookies cumple WCAG 2.2 AA (${colorScheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/ca')
    await expect(page.getByRole('dialog', { name: 'Galetes' })).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(
      violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`),
    ).toEqual([])
    await context.close()
  })

  test(`el diálogo de preferencias de cookies cumple WCAG 2.2 AA (${colorScheme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/ca')
    const banner = page.getByRole('dialog', { name: 'Galetes' })
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Preferències', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Preferències de galetes' })).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(
      violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`),
    ).toEqual([])
    await context.close()
  })
}

// Regresión directa sobre el HTML inicial (sin JavaScript) de la 404, para
// el mismo defecto que `KNOWN_BROKEN_PATHS` deja en `fixme` más arriba:
// vercel/next.js#98295, el boundary de `notFound()` no llega al HTML que
// sirve el servidor y solo aparece tras hidratar. El código de estado ya
// es correcto hoy; `lang`, `<title>` y el titular todavía no lo son sin
// JS. Este test se pondrá en verde solo cuando Next.js lo corrija.
test.fixme('el HTML inicial de /ca/no-existe es accesible sin JavaScript', async ({ request }) => {
  const response = await request.get('/ca/no-existe')
  expect(response.status()).toBe(404)

  const html = await response.text()
  expect(html).toMatch(/<html[^>]*\blang="ca"/)
  expect(html).toMatch(/<title>[^<]+<\/title>/)
  expect(html).toContain('Pàgina no trobada')
})
