// La comprovació de `robots.txt` llegeix el fitxer servit, que surt d'un `pnpm build` previ (`postbuild` → `next-sitemap`): la política en si es comprova a `tests/int/robotsPolicy.int.spec.ts`.
import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { contractSubscription, pageGraphTypes, planSuperUser, setSubscription } from './helpers/subscription'

/**
 * Dades estructurades (spec §20.3): la pàgina d'inici porta un graf JSON-LD
 * que es parseja i que surt dels ajustos sembrats (telèfon i població).
 */
test('la portada porta un graf schema.org amb el negoci local', async ({ page }) => {
  await page.goto('/ca')
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(raw).toBeTruthy()
  const graph = JSON.parse(raw!) as { '@context': string; '@graph': Array<Record<string, unknown>> }
  expect(graph['@context']).toBe('https://schema.org')
  const types = graph['@graph'].map((n) => n['@type'])
  // El negoci local és del subtipus de la demo (`siteConfig.seo.schemaType`).
  expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'HomeAndConstructionBusiness']))
  const biz = graph['@graph'].find((n) => n['@type'] === 'HomeAndConstructionBusiness')!
  expect(biz.telephone).toBeTruthy()
  expect((biz.address as { addressLocality: string }).addressLocality).toBe('Vila Exemple')
  expect((biz.geo as { latitude: number }).latitude).toBeCloseTo(40.0, 3)
})

test('robots.txt permet les imatges i tanca l’API i l’admin', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text()
  expect(body).toContain('Allow: /api/media/file/')
  expect(body).toContain('Disallow: /admin')
  expect(body).toContain('Disallow: /api/')
})

/**
 * Spec §20.5: l'adreça estructurada s'edita des del panell. Sense aquest grup
 * visible, el graf de dalt només el podria omplir el seed.
 */
test.describe('ajustos del web al panell', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('els ajustos del web porten el grup d’ubicació per al SEO local', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('/admin/globals/site-settings')

    // Etiquetes en anglès: el panell segueix l'idioma del compte i Playwright
    // navega en anglès (en-US), com a `roles.e2e.spec.ts`.
    const contactTab = page.locator('button.tabs-field__tab-button', { hasText: 'Contact' }).first()
    await expect(contactTab).toBeVisible()
    if (!(await contactTab.evaluate((tab) => tab.classList.contains('tabs-field__tab-button--active')))) {
      await contactTab.click()
    }

    const location = page.locator('#field-location')
    await expect(location.getByText('Location (local SEO)', { exact: true })).toBeVisible()
  })
})

/**
 * Spec §22.3: el graf JSON-LD per pàgina (segon `<script type="application/ld+json">`),
 * distint del graf del layout que ja prova el primer test d'aquest fitxer.
 */
test.describe('graf JSON-LD per pàgina', () => {
  test.beforeAll(async () => {
    await seedTestUser(planSuperUser)
  })

  test.afterAll(async ({ playwright }) => {
    // Mateix motiu que `activeLocales.e2e.spec.ts`: `request` no és
    // disponible dins d'`afterAll`, així que es crea un context propi contra
    // el `baseURL` configurat al projecte.
    const request = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await setSubscription(request, contractSubscription)
    await request.dispose()
    await cleanupTestUser(planSuperUser)
  })

  test('sense advanced-seo: WebPage a tot arreu, BreadcrumbList fora de l’inici, cap Service', async ({ page, request }) => {
    await setSubscription(request, { modules: [] })
    await page.goto('/ca')
    const home = await pageGraphTypes(page)
    expect(home).toContain('WebPage')
    expect(home).not.toContain('BreadcrumbList')
    expect(home).not.toContain('Service')
    await page.goto('/ca/serveis')
    expect(await pageGraphTypes(page)).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList']))
  })

  test('amb advanced-seo: la portada declara els serveis del servicesGrid', async ({ page, request }) => {
    await setSubscription(request, { modules: ['advanced-seo'] })
    await page.goto('/ca')
    expect((await pageGraphTypes(page)).filter((t) => t === 'Service').length).toBeGreaterThan(0)
  })
})
