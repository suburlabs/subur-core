import { expect, test } from '@playwright/test'

import { cleanupTestUser, seedTestUser } from '../helpers/seedUser'
import { contractSubscription, planSuperUser, setSubscription } from './helpers/subscription'

/**
 * `/llms.txt` (llmstxt.org, spec §22.4): sense el mòdul `ai-visibility` no
 * existeix; amb el mòdul, cada enllaç que publica ha de respondre 200 sense
 * redirecció.
 */
test.describe('/llms.txt', () => {
  test.beforeAll(async () => {
    await seedTestUser(planSuperUser)
  })

  test.afterAll(async ({ playwright }) => {
    // Mateix motiu que `seo.e2e.spec.ts` i `faq.e2e.spec.ts`: `request` no és
    // disponible dins d'`afterAll`, així que es crea un context propi contra
    // el `baseURL` configurat al projecte.
    const request = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await setSubscription(request, contractSubscription)
    await request.dispose()
    await cleanupTestUser(planSuperUser)
  })

  test('sense ai-visibility: 404', async ({ request }) => {
    await setSubscription(request, { modules: [] })
    expect((await request.get('/llms.txt')).status()).toBe(404)
  })

  test('amb ai-visibility: 200 text/plain i cada enllaç respon 200 sense redirecció', async ({ request }) => {
    await setSubscription(request, { modules: ['ai-visibility'] })
    const response = await request.get('/llms.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8')
    const text = await response.text()
    const urls = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const { pathname } = new URL(url)
      const page = await request.get(pathname, { maxRedirects: 0 })
      expect(page.status(), pathname).toBe(200)
    }
  })
})
