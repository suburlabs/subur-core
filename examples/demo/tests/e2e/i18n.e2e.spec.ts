import { expect, test } from '@playwright/test'

const slugs = ['home', 'serveis', 'contacte', 'avis-legal', 'privacitat', 'cookies']
const locales = ['es', 'ca', 'en']

test.describe('localized routing', () => {
  // A la demo, l'idioma per defecte és el català: els papers de `es` i `ca` de l'arrel s'intercanvien.
  test('redirects the root to Catalan for unsupported browsers', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/ca$/)
    await context.close()
  })

  test('redirects the root to Spanish when the browser prefers it', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'es-ES' })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/es$/)
    await context.close()
  })

  test('sends unsupported locale prefixes to Catalan', async ({ page }) => {
    await page.goto('/fr/serveis')
    await expect(page).toHaveURL(/\/ca\/serveis$/)
  })

  for (const locale of locales) {
    for (const slug of slugs) {
      test(`renders ${locale}/${slug}`, async ({ page }) => {
        const path = slug === 'home' ? `/${locale}` : `/${locale}/${slug}`
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        await expect(page.locator('h1').first()).toBeVisible()
      })
    }
  }

  test('the locale switcher keeps the current page and remembers the choice', async ({ page }) => {
    await page.goto('/ca/contacte')
    await page.getByRole('banner').getByRole('radio', { name: 'Español' }).click()
    await expect(page).toHaveURL(/\/es\/contacte$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await page.goto('/')
    await expect(page).toHaveURL(/\/es$/)
  })

  test('unknown pages return a localized 404', async ({ page }) => {
    const response = await page.goto('/en/does-not-exist')
    expect(response?.status()).toBe(404)
    await expect(page.locator('[data-site-header]')).toBeVisible()

    // The message lives inside the system's signature ceramic plaque, and the
    // page offers two doors: home, and the phone. Asserting the structure — not
    // just the text — keeps the 404 from drifting back into a decorative panel.
    const plaque = page.locator('main .plaque')
    await expect(plaque).toHaveCount(1)
    await expect(plaque.locator('h1')).toHaveText('Page not found')
    await expect(plaque.locator('a[href="/en"]')).toBeVisible()
    await expect(plaque.locator('a[href^="tel:"]')).toBeVisible()

    // The drawn-shutter panel was rejected four times and is now deleted. If it
    // ever comes back, it fails here first.
    await expect(page.locator('.reveal')).toHaveCount(0)
  })
})
