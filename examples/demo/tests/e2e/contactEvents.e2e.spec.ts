import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'

type StubbedWindow = { __umamiCalls?: string[]; umami?: { track: (name: string) => void } }
const readUmamiCalls = () => (window as unknown as StubbedWindow).__umamiCalls ?? []
const hasUmami = () => typeof (window as unknown as StubbedWindow).umami !== 'undefined'

/**
 * Els quatre esdeveniments de contacte (spec §22.5) només surten quan
 * `measurement` s'ha acceptat, amb un sol escoltador delegat
 * (`src/analytics/ContactEvents.tsx`) i `trackEvent('contact-form')` des de
 * `ContactForm.tsx` quan el servidor accepta l'enviament. Per córrer aquest
 * fitxer: NEXT_PUBLIC_UMAMI_WEBSITE_ID=<id> i
 * NEXT_PUBLIC_UMAMI_SCRIPT_URL=<url> al servidor de proves (mateix patró que
 * `tests/e2e/analytics.e2e.spec.ts`), a més de les mateixes variables passades
 * a Playwright.
 */
const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL
test.skip(!websiteId || !scriptUrl, 'sense variables NEXT_PUBLIC_UMAMI_* al servidor de proves')

const UMAMI_STUB = `window.__umamiCalls = [];
window.umami = { track: (name) => window.__umamiCalls.push(name) };`

async function stubUmamiScript(page: import('@playwright/test').Page): Promise<void> {
  await page.route(scriptUrl!, async (route) => {
    await route.fulfill({ body: UMAMI_STUB, contentType: 'application/javascript' })
  })
}

async function acceptMeasurement(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/ca')
  await page.getByRole('dialog', { name: 'Galetes' }).getByRole('button', { name: 'Accepta', exact: true }).click()
}

async function preventTelNavigation(page: import('@playwright/test').Page): Promise<void> {
  // El clic al `tel:` no ha d'intentar navegar. Registrat en fase de
  // bombolla: l'escoltador de `ContactEvents` (fase de captura) ja haurà
  // corregut abans que aquest `preventDefault` actuï.
  await page.evaluate(() => document.addEventListener('click', (event) => event.preventDefault()))
}

test.describe('esdeveniments de contacte', () => {
  // Correus que el test del formulari crea. Es registra ABANS de l'enviament
  // (no després de l'assert): si qualsevol `expect` d'aquell test llença,
  // `afterAll` igualment sap quin correu buscar i esborrar. Independent de
  // l'ordre o de si el test falla, `afterAll` sempre corre.
  const createdEmails: string[] = []

  test.afterAll(async () => {
    if (createdEmails.length === 0) return
    const payload = await getPayload({ config })
    // `submissionData` és un array de subcamps (`{field, value}`), no es pot
    // filtrar per valor amb un `where` del CMS: es llisten les trameses
    // més recents i es comparen en memòria.
    const { docs } = await payload.find({ collection: 'form-submissions', limit: 50, sort: '-createdAt' })
    for (const doc of docs) {
      const email = doc.submissionData?.find((entry) => entry.field === 'email')?.value
      if (email && createdEmails.includes(email)) {
        await payload.delete({ collection: 'form-submissions', id: doc.id })
      }
    }
  })

  test('acceptar → clic al telèfon del peu → contact-phone', async ({ page }) => {
    await stubUmamiScript(page)
    await acceptMeasurement(page)
    await preventTelNavigation(page)

    const telLink = page.locator('[data-site-footer]').locator('a[href^="tel:"]').first()
    await telLink.scrollIntoViewIfNeeded()
    await telLink.click()

    await expect.poll(() => page.evaluate(readUmamiCalls)).toContain('contact-phone')
  })

  test('acceptar → enviar el formulari de contacte → contact-form', async ({ page }) => {
    const payload = await getPayload({ config })
    await stubUmamiScript(page)
    await acceptMeasurement(page)

    const email = `e2e-contact-events-${Date.now()}@example.com`
    // Registrat ABANS de l'enviament: si el que ve després llença (l'`expect`
    // de l'estat, el `poll` de l'esdeveniment o la comprovació de la tramesa),
    // `afterAll` sap igualment quin correu netejar (vegeu més amunt).
    createdEmails.push(email)

    await page.goto('/ca/contacte')
    await page.getByLabel('Nom').fill('Prova E2E esdeveniments')
    await page.getByLabel('Correu').fill(email)
    await page.getByLabel('Missatge').fill('Missatge de prova dels esdeveniments de contacte')
    await page.getByRole('checkbox', { name: /política de privacitat/i }).click()
    await page.getByRole('button', { name: 'Envia' }).click()

    await expect(page.getByRole('status')).toContainText('Hem rebut el missatge')
    await expect.poll(() => page.evaluate(readUmamiCalls)).toContain('contact-form')

    const { docs } = await payload.find({
      collection: 'form-submissions',
      limit: 1,
      sort: '-createdAt',
    })
    const created = docs[0]
    const matchesEmail = created?.submissionData?.some(
      (entry: { field: string; value: string }) => entry.field === 'email' && entry.value === email,
    )
    expect(matchesEmail, 'la darrera tramesa ha de ser la d\'aquest test').toBe(true)
    // La neteja real es fa a `afterAll`, no aquí: si l'`expect` anterior
    // llença, aquesta línia mai s'executaria.
  })

  test('rebutjar → clic al telèfon → sense window.umami ni petició a l\'script', async ({ page }) => {
    const scriptRequests: string[] = []
    page.on('request', (request) => {
      if (request.url() === scriptUrl) scriptRequests.push(request.url())
    })
    await stubUmamiScript(page)

    await page.goto('/ca')
    await page.getByRole('dialog', { name: 'Galetes' }).getByRole('button', { name: 'Rebutja', exact: true }).click()
    await preventTelNavigation(page)

    const telLink = page.locator('[data-site-footer]').locator('a[href^="tel:"]').first()
    await telLink.scrollIntoViewIfNeeded()
    await telLink.click()
    await page.waitForTimeout(500)

    const umamiExists = await page.evaluate(hasUmami)
    expect(umamiExists).toBe(false)
    expect(scriptRequests).toEqual([])
  })
})
