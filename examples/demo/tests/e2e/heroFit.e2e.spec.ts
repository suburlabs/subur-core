import { expect, test } from '@playwright/test'

/**
 * El rètol de cada escena ha de veure's sencer i centrat a l'espai que queda
 * entre la capçalera i el carril de peu d'escenari, a qualsevol mida. El
 * carril canvia d'alçada (fa dues línies en amplades mitjanes) i l'escenari
 * és tan alt com la finestra: cap de les dues coses pot retallar la rajola.
 */
const viewports = [
  { height: 568, width: 320 },
  { height: 640, width: 360 },
  { height: 844, width: 390 },
  { height: 932, width: 430 },
  { height: 560, width: 627 },
  { height: 1024, width: 768 },
  { height: 480, width: 860 },
  { height: 600, width: 1024 },
  { height: 720, width: 1280 },
  { height: 600, width: 1366 },
  { height: 900, width: 1440 },
  { height: 900, width: 2560 },
  // Telèfons apaïsats: l'escenari més baix que existeix.
  { height: 375, width: 667 },
  { height: 390, width: 844 },
]

const MIN_MARGIN = 8
const CENTER_TOLERANCE = 2

for (const locale of ['ca', 'es', 'en']) {
  test(`/${locale}: every hero plaque fits between the header and the rail, centred`, async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: viewports[0] })
    const page = await context.newPage()
    await page.goto(`/${locale}`)
    await expect(page.locator('[data-hero-stage]')).toBeVisible()

    const failures: string[] = []

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      // El pin de GSAP refà les mides de l'escenari un instant després del
      // canvi de finestra: es mesura quan ja torna a ocupar el que li toca.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const stage = document.querySelector('[data-hero-stage]')!.getBoundingClientRect()
            const header = document.querySelector('[data-site-header]')!.getBoundingClientRect()
            return Math.abs(stage.height - (window.innerHeight - header.height)) + Math.abs(stage.top - header.bottom)
          }),
        )
        .toBeLessThanOrEqual(1)

      const boxes = await page.evaluate(() => {
        const stage = document.querySelector('[data-hero-stage]')!
        const rail = stage.querySelector('.hero-rail')!
        return {
          plaques: [...stage.querySelectorAll('[data-beat] > .plaque')].map((el) => {
            const { bottom, left, right, top } = el.getBoundingClientRect()
            return { bottom, left, right, top }
          }),
          railTop: rail.getBoundingClientRect().top,
          stageTop: stage.getBoundingClientRect().top,
          width: document.documentElement.clientWidth,
        }
      })

      boxes.plaques.forEach((plaque, beat) => {
        const above = plaque.top - boxes.stageTop
        const below = boxes.railTop - plaque.bottom
        const where = `${viewport.width}×${viewport.height} beat ${beat}`
        if (above < MIN_MARGIN || below < MIN_MARGIN) {
          failures.push(`${where}: clipped (above ${above.toFixed(1)}px, below ${below.toFixed(1)}px)`)
        } else if (Math.abs(above - below) > CENTER_TOLERANCE) {
          failures.push(`${where}: off-centre (above ${above.toFixed(1)}px, below ${below.toFixed(1)}px)`)
        }
        if (plaque.left < 0 || plaque.right > boxes.width) {
          failures.push(`${where}: overflows horizontally (${plaque.left.toFixed(1)}–${plaque.right.toFixed(1)} of ${boxes.width})`)
        }
      })
    }

    expect(failures).toEqual([])
    await context.close()
  })
}
