import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page
  let startedAt: string

  test.beforeAll(async ({ browser }, testInfo) => {
    startedAt = new Date().toISOString()
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    // «Páginas» té autosave: només d'obrir `/create`, el panell desa un
    // esborrany buit. Sense això, cada execució en deixava un («<No Title>»)
    // a la llista fins al següent seed. S'esborra el que aquesta execució ha
    // creat: sense slug i posterior a l'inici de la prova.
    const payload = await getPayload({ config })
    const deleted = await payload.delete({
      collection: 'pages',
      context: { disableRevalidate: true },
      where: {
        and: [{ slug: { exists: false } }, { createdAt: { greater_than_equal: startedAt } }],
      },
    })
    if (deleted.errors.length > 0) {
      throw new Error(`No se han podido borrar los borradores de la prueba: ${JSON.stringify(deleted.errors)}`)
    }

    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin')
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users(\?.*)?$/)
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('/admin/collections/pages/create')
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="title"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
