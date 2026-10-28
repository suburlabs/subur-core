import { expect, test, type Page } from '@playwright/test'

/**
 * Les parelles de tokens ja es mesuren a `tests/int/theme.int.spec.ts`, però
 * aquell test llegeix `theme.css`: no sap res del que arriba realment a la
 * pantalla. Per això va passar en verd mentre les pàgines legals pintaven els
 * titulars a 1,00:1 — el plugin de tipografia emet el seu `.prose` sense capa
 * i guanyava les variables del projecte, que vivien dins `@layer components`.
 *
 * Aquest fitxer mesura el resultat renderitzat, que és l'única cosa que veu
 * una persona.
 */

/**
 * `pnpm test:e2e` carrega els specs amb `tsx/esm`, i esbuild embolcalla cada
 * funció amb nom amb el seu helper `__name` per conservar-ne el nom. Aquest
 * helper existeix al mòdul de Node, però no dins la pàgina: quan Playwright
 * serialitza una crida a `page.evaluate` que en porti, el navegador peta amb
 * `ReferenceError: __name is not defined`. Aquí n'hi ha, perquè la mesura de
 * contrast es llegeix molt millor amb funcions auxiliars que inline.
 *
 * El shim les deixa passar sense tocar res més. Sense això el fitxer passa amb
 * `npx playwright test` i falla amb `pnpm test:e2e`, que és el pitjor dels dos
 * mons.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const scope = globalThis as Record<string, unknown>
    if (typeof scope.__name !== 'function') scope.__name = (value: unknown) => value
  })
})

// Les pàgines de la demo, en l'idioma per defecte (ca), i una 404.
const PAGES = [
  '/ca',
  '/ca/serveis',
  '/ca/contacte',
  '/ca/privacitat',
  '/ca/avis-legal',
  '/ca/cookies',
  '/ca/no-existe',
]

type Failure = {
  bg: string
  color: string
  fontSize: string
  need: number
  ratio: string
  tag: string
  text: string
}

/** Recorre el text visible i torna el que no arriba al mínim de WCAG 2.2 AA. */
const collectFailures = (page: Page): Promise<Failure[]> =>
  page.evaluate(() => {
    const channel = (value: number) => {
      const srgb = value / 255
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
    }
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)
      return parts ? parts.slice(0, 3).map(Number) : null
    }
    const alpha = (value: string) => {
      const parts = value.match(/[\d.]+/g)
      return parts && parts.length > 3 ? Number(parts[3]) : 1
    }
    // El primer avantpassat amb un fons opac és el que es veu darrere del text.
    const backgroundBehind = (element: Element) => {
      let node: Element | null = element
      while (node && node !== document.documentElement) {
        const value = getComputedStyle(node).backgroundColor
        if (value && alpha(value) > 0.9) return parse(value)
        node = node.parentElement
      }
      return parse(getComputedStyle(document.body).backgroundColor)
    }

    const failures = []
    for (const element of document.querySelectorAll('header *, main *, footer *')) {
      const ownsText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 1,
      )
      if (!ownsText) continue

      const box = element.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue

      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue
      if (element.closest('.sr-only, [aria-hidden="true"]')) continue

      const color = parse(style.color)
      const background = backgroundBehind(element)
      if (!color || !background) continue

      const fontSize = Number.parseFloat(style.fontSize)
      const isBold = Number.parseInt(style.fontWeight, 10) >= 700
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold)
      const need = isLarge ? 3 : 4.5
      const measured = ratio(color, background)
      if (measured >= need) continue

      failures.push({
        bg: `rgb(${background.join(', ')})`,
        color: style.color,
        fontSize: style.fontSize,
        need,
        ratio: measured.toFixed(2),
        tag: element.tagName,
        text: (element.textContent ?? '').trim().slice(0, 40),
      })
    }
    return failures
  })

const describeFailure = (f: Failure) =>
  `<${f.tag.toLowerCase()}> "${f.text}" — ${f.ratio}:1, cal ${f.need}:1 (${f.color} sobre ${f.bg}, ${f.fontSize})`

/**
 * `networkidle` no arriba mai a la portada: el `<video>` del hero baixa el film
 * amb `fetch` i el munta com a `blob:` (vegeu `ScrollHeroFilm`), i aquesta
 * baixada d'un fitxer de vídeo sencer manté el navegador «ocupat» prou
 * estona com per esgotar el timeout del test abans que la xarxa quedi mai
 * inactiva. `page.goto` ja espera l'esdeveniment `load` (el seu `waitUntil`
 * per defecte), que és quan els colors ja són als llocs correctes —les
 * regles de `prefers-color-scheme` són pures CSS i els beats inactius del
 * hero ja porten `opacity: 0` per un selector de `data-active` present a
 * l'HTML servit, sense dependre de cap script. L'única cosa que encara pot
 * canviar després de `load` és la mètrica del tipus de lletra, així que
 * només cal esperar `document.fonts.ready` abans de mesurar.
 */
const waitForPageReady = (page: Page) => page.evaluate(() => document.fonts.ready)

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`contrast — tema ${scheme}`, () => {
    test.use({ colorScheme: scheme })

    // Un sol test per tema, no un per pàgina: cada test obre un context de
    // navegador nou, i vint contextos de més feien caure la suite sencera per
    // esgotament («timeout while setting up context», en un test diferent cada
    // vegada). Com que les fallades s'acumulen en una llista, un sol test les
    // reporta totes igualment, amb la pàgina a cada línia.
    test('cap text baixa del mínim AA en cap pàgina', async ({ page }) => {
      const failures: string[] = []
      for (const path of PAGES) {
        await page.goto(path)
        await waitForPageReady(page)
        for (const failure of await collectFailures(page)) {
          failures.push(`${path} — ${describeFailure(failure)}`)
        }
      }
      expect(failures, `contrast en tema ${scheme}`).toEqual([])
    })

    test(`l'anell de focus es veu sobre tots tres camps`, async ({ page }) => {
      await page.goto('/ca/no-existe')
      await waitForPageReady(page)

      // Pàgina (calç/tinta), rajola (plaque) i persiana (peu) tenen fons
      // diferents, i `--ring` es redefineix a cada camp per contrastar-hi.
      const onTile = await ringContrast(page, 'main .plaque a[href^="tel:"]')
      expect(onTile, 'anell sobre la rajola').toBeGreaterThanOrEqual(3)

      const onShutter = await ringContrast(page, '[data-site-footer] a[href^="mailto:"]')
      expect(onShutter, 'anell sobre la persiana').toBeGreaterThanOrEqual(3)
    })
  })
}

/** Enfoca l'element i mesura l'`outline` contra el fons que té a sota. */
async function ringContrast(page: Page, selector: string): Promise<number> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  await target.focus()
  return page.evaluate((sel) => {
    const channel = (value: number) => {
      const srgb = value / 255
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
    }
    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)
      return parts ? parts.slice(0, 3).map(Number) : [0, 0, 0]
    }
    const alpha = (value: string) => {
      const parts = value.match(/[\d.]+/g)
      return parts && parts.length > 3 ? Number(parts[3]) : 1
    }
    const element = document.querySelector(sel)!
    const outline = parse(getComputedStyle(element).outlineColor)
    let node: Element | null = element
    let background = parse(getComputedStyle(document.body).backgroundColor)
    while (node && node !== document.documentElement) {
      const value = getComputedStyle(node).backgroundColor
      if (value && alpha(value) > 0.9) {
        background = parse(value)
        break
      }
      node = node.parentElement
    }
    const [hi, lo] = [luminance(outline), luminance(background)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }, selector)
}
