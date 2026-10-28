import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

// Distinct from tests/helpers/seedUser's default `testUser`: admin.e2e.spec.ts
// and this file run concurrently in different Playwright workers, and both
// previously raced to delete/create the same "users" row, which occasionally
// made the dashboard render as "create your first user" instead of logging in.
const testUser: TestUser = { email: 'branding-e2e@subur.dev', password: 'test', role: 'superadmin' }
const clientUser: TestUser = { email: 'branding-e2e-client@subur.dev', password: 'test', role: 'admin' }

test.describe('Subur branding', () => {
  test.beforeAll(async () => {
    await seedTestUser(testUser)
    await seedTestUser(clientUser)
  })

  test.afterAll(async () => {
    await cleanupTestUser(clientUser)
    await cleanupTestUser(testUser)
  })

  test('the login page shows Subur', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page).toHaveTitle(/Subur/)
    await expect(page.getByText('Subur').first()).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(/payload/i)
  })

  test('the dashboard never mentions the engine', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('/admin')
    // El tauler segueix l'idioma d'admin de l'usuari (Tasca 9): el testid, no
    // el text traduït, confirma que ha carregat (ruling 5).
    await expect(page.getByTestId('dashboard-locales')).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(/payload/i)
  })

  test('the account page never mentions the engine (superadmin)', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('/admin/account')
    expect(await page.locator('body').innerText()).not.toMatch(/payload/i)
  })

  test('the account page never mentions the engine (client)', async ({ page }) => {
    await login({ page, user: clientUser })
    await page.goto('/admin/account')
    expect(await page.locator('body').innerText()).not.toMatch(/payload/i)
  })

  test('public pages never mention the engine', async ({ page }) => {
    for (const path of ['/ca', '/ca/contacte', '/en/serveis']) {
      await page.goto(path)
      expect(await page.locator('body').innerText()).not.toMatch(/payload/i)
    }
  })
})
