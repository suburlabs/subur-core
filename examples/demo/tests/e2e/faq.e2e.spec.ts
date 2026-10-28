import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'
import { dismissConsent } from './helpers/consent'
import { contractSubscription, pageGraphTypes, planSuperUser, setSubscription } from './helpers/subscription'

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Bloc FAQ (spec §22.3): l'acordió es desplega amb teclat i el seu JSON-LD
 * (`FAQPage`) només surt amb el mòdul `advanced-seo`. La pàgina `faq-e2e` és temporal, creada
 * per l'API local i esborrada en acabar.
 */
test.describe('bloc FAQ', () => {
  test.beforeAll(async () => {
    await seedTestUser(planSuperUser)

    const payload = await getPayload({ config })
    // `disableRevalidate`: aquest procés de proves crida l'API local fora de
    // qualsevol petició de Next (com el `delete` net de `admin.e2e.spec.ts`);
    // `revalidatePath` exigeix l'«static generation store» d'una petició
    // real i llença si no hi és. La pàgina és nova, així que no hi ha res
    // per revalidar: la primera visita ja la renderitza fresca.
    await payload.create({
      collection: 'pages',
      context: { disableRevalidate: true },
      data: {
        _status: 'published',
        layout: [
          { blockType: 'pageHero', heading: 'Preguntes freqüents' },
          {
            blockType: 'faq',
            items: [
              { answer: 'Sí, al matí.', question: 'Treballeu els dissabtes?' },
              { answer: 'Una hora.', question: 'Hi ha un mínim?' },
            ],
          },
        ],
        slug: 'faq-e2e',
        title: 'Preguntes freqüents',
      },
      locale: 'ca',
    })
  })

  test.afterAll(async ({ playwright }) => {
    const payload = await getPayload({ config })
    const deleted = await payload.delete({
      collection: 'pages',
      context: { disableRevalidate: true },
      where: { slug: { equals: 'faq-e2e' } },
    })
    if (deleted.errors.length > 0) {
      throw new Error(`No se ha podido borrar la página temporal "faq-e2e": ${JSON.stringify(deleted.errors)}`)
    }

    // Mateix motiu que `seo.e2e.spec.ts`: `request` no és disponible dins
    // d'`afterAll`, així que es crea un context propi contra el `baseURL`
    // configurat al projecte.
    const request = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await setSubscription(request, contractSubscription)
    await request.dispose()
    await cleanupTestUser(planSuperUser)
  })

  test('l’acordió es desplega i es plega amb el teclat', async ({ page }) => {
    await page.goto('/ca/faq-e2e')
    await dismissConsent(page)
    const first = page.getByRole('button', { name: 'Treballeu els dissabtes?' })
    await first.focus()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Sí, al matí.')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('aria-expanded', 'false')
  })

  test('FAQPage només amb advanced-seo', async ({ page, request }) => {
    await setSubscription(request, { modules: [] })
    await page.goto('/ca/faq-e2e')
    expect(await pageGraphTypes(page)).not.toContain('FAQPage')
    await setSubscription(request, { modules: ['advanced-seo'] })
    await page.goto('/ca/faq-e2e')
    expect(await pageGraphTypes(page)).toContain('FAQPage')
  })

  // `a11y.e2e.spec.ts` només audita rutes fixes del seed: aquesta pàgina la
  // crea el propi test, així que l'anàlisi d'axe amb les mateixes etiquetes
  // viu aquí (com al fitxer general, el bàner de consentiment es queda
  // visible durant l'anàlisi — més cobertura, no menys).
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`la pàgina compleix WCAG 2.2 AA (${colorScheme})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await page.goto('/ca/faq-e2e')
      const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze()
      expect(
        violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`),
      ).toEqual([])
      await context.close()
    })
  }
})
