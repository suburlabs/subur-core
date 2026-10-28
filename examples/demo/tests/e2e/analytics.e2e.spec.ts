import { expect, test } from '@playwright/test'

/**
 * L'script d'Umami només es carrega sota `measurement` (spec §21.3). Per
 * córrer aquest fitxer: NEXT_PUBLIC_UMAMI_WEBSITE_ID=test i
 * NEXT_PUBLIC_UMAMI_SCRIPT_URL=http://localhost:<port>/site/umami-fake.js
 * al servidor de proves (un fitxer estàtic buit val: només es comprova el tag).
 */
const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL
test.skip(!websiteId || !scriptUrl, 'sense variables NEXT_PUBLIC_UMAMI_* al servidor de proves')

const umamiTag = (page: import('@playwright/test').Page) => page.locator(`script[data-website-id="${websiteId}"]`)

test('rechazar la medición: ningún script de Umami', async ({ page }) => {
  await page.goto('/es')
  await page.getByRole('dialog', { name: 'Cookies' }).getByRole('button', { name: 'Rechazar', exact: true }).click()
  await page.waitForTimeout(500)
  await expect(umamiTag(page)).toHaveCount(0)
})

test('aceptar la medición: el script de Umami se carga con el website id', async ({ page }) => {
  await page.goto('/es')
  await page.getByRole('dialog', { name: 'Cookies' }).getByRole('button', { name: 'Aceptar', exact: true }).click()
  await expect(umamiTag(page)).toHaveCount(1)
  await expect(umamiTag(page)).toHaveAttribute('src', scriptUrl!)
  await page.reload()
  await expect(umamiTag(page)).toHaveCount(1)
})
