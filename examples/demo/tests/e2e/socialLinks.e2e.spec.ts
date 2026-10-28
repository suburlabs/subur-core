import { expect, test } from '@playwright/test'

import { dismissConsent } from './helpers/consent'

test.describe('footer social links', () => {
  test('links the WhatsApp derived from the published phone, and invents no Instagram/Facebook', async ({
    page,
  }) => {
    await page.goto('/ca')
    await dismissConsent(page)

    const footer = page.locator('footer')
    const whatsapp = footer.getByRole('link', { name: 'WhatsApp' })
    await expect(whatsapp).toBeVisible()
    await expect(whatsapp).toHaveAttribute('href', 'https://wa.me/34600000000')

    await expect(footer.getByRole('link', { name: 'Instagram' })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Facebook' })).toHaveCount(0)
  })
})
