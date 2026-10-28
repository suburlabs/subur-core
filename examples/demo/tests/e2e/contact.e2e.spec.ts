import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'

test.describe('contact form', () => {
  test('requires the privacy consent', async ({ page }) => {
    await page.goto('/ca/contacte')
    await page.getByLabel('Nom').fill('Prova E2E')
    await page.getByLabel('Correu').fill('e2e@example.com')
    await page.getByLabel('Missatge').fill('Missatge de prova')
    await page.getByRole('button', { name: 'Envia' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Aquest camp és obligatori' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('stores a valid submission', async ({ page }) => {
    const payload = await getPayload({ config })
    const before = (await payload.count({ collection: 'form-submissions' })).totalDocs

    await page.goto('/ca/contacte')
    await page.getByLabel('Nom').fill('Prova E2E')
    await page.getByLabel('Correu').fill('e2e@example.com')
    await page.getByLabel('Missatge').fill('Missatge de prova')
    await page.getByRole('checkbox', { name: /política de privacitat/i }).click()
    await page.getByRole('button', { name: 'Envia' }).click()

    await expect(page.getByRole('status')).toContainText('Hem rebut el missatge')
    await expect
      .poll(async () => (await payload.count({ collection: 'form-submissions' })).totalDocs)
      .toBe(before + 1)
  })
})
