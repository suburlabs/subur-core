import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'

const superUser: TestUser = { email: 'roles-super@subur.dev', password: 'test', role: 'superadmin' }
const clientUser: TestUser = { email: 'roles-client@subur.dev', password: 'test', role: 'admin' }

test.describe('panel según el rol', () => {
  test.beforeAll(async () => {
    await seedTestUser(superUser)
    await seedTestUser(clientUser)
  })

  test.afterAll(async () => {
    await cleanupTestUser(clientUser)
    await cleanupTestUser(superUser)
  })

  test('el administrador del cliente no ve usuarios ni redirecciones', async ({ page }) => {
    await login({ page, user: clientUser })

    // Hrefs, no el text visible: el panell d'un client segueix l'idioma del
    // seu compte (Tasca 4) i Playwright navega en anglès (en-US).
    const nav = page.locator('nav')
    await expect(nav.locator('a[href="/admin/collections/pages"]')).toBeVisible()
    await expect(nav.locator('a[href="/admin/collections/users"]')).toHaveCount(0)
    await expect(nav.locator('a[href="/admin/collections/redirects"]')).toHaveCount(0)
    await expect(nav.locator('a[href="/admin/globals/subscription"]')).toHaveCount(0)
    expect((await page.request.get('/api/globals/subscription')).status()).toBe(403)
    expect((await page.request.get('/api/redirects')).status()).toBe(403)

    await page.goto('/admin/collections/users')
    await expect(page.locator('table')).toHaveCount(0)

    const response = await page.request.get('/api/users')
    const body = (await response.json()) as { docs: { email: string }[] }
    expect(body.docs.map((doc) => doc.email)).toEqual([clientUser.email])
  })

  test('el administrador del cliente puede editar su cuenta, pero no su rol', async ({ page }) => {
    await login({ page, user: clientUser })
    await page.goto('/admin/account')
    await expect(page.locator('#field-email')).toHaveValue(clientUser.email)
    // El camp `role` és visible (`access.update` no n'amaga la lectura) però
    // de només lectura per a qui no és superadmin: comprovat al navegador,
    // el CMS el marca amb la classe `read-only` i deshabilita el `select`.
    await expect(page.locator('#field-role')).toHaveClass(/read-only/)
  })

  test('el superadministrador ve la lista de usuarios', async ({ page }) => {
    await login({ page, user: superUser })
    await page.goto('/admin/collections/users')
    await expect(page.locator('table')).toBeVisible()

    await page.goto('/admin/globals/subscription')
    await expect(page.locator('#field-plan')).toBeVisible()
  })

  test('el panel de inicio enseña los idiomas contratados', async ({ page }) => {
    await login({ page, user: clientUser })
    const card = page.getByTestId('dashboard-locales')
    await expect(card.locator('li[data-active="true"]')).toHaveCount(3)
    await expect(card.getByRole('link')).toHaveCount(0)

    // El `lang` va en el nombre nativo del idioma, no en toda la fila: la
    // fila también contiene el estado en el idioma de admin del usuario.
    await expect(card.locator('li[lang]')).toHaveCount(0)
    await expect(card.locator('li strong[lang]')).toHaveCount(3)
  })

  test('el alta de usuarios por HTTP está cerrada', async ({ page, request }) => {
    const intruder = 'planf-intruso@subur.dev'

    // La ruta «primer usuario» del motor ya no existe: la tapa la de la colección.
    const firstRegister = await request.post('/api/users/first-register', {
      data: { email: intruder, password: 'una-contrasena-larga-1', role: 'superadmin' },
    })
    expect(firstRegister.status()).toBe(404)

    // Y el alta normal por HTTP, autenticado como el administrador del cliente.
    await login({ page, user: clientUser })
    const asClient = await page.request.post('/api/users', {
      data: { email: intruder, name: 'x', password: 'una-contrasena-larga-1', role: 'admin' },
    })
    expect(asClient.status()).toBe(403)

    const payload = await getPayload({ config })
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { email: { equals: intruder } },
    })
    expect(totalDocs).toBe(0)
  })

  test('el superadministrador crea el usuario del cliente desde el panel', async ({ page }) => {
    const created = 'planf-alta-super@subur.dev'
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: created } } })

    await login({ page, user: superUser })
    const response = await page.request.post('/api/users', {
      data: { email: created, name: 'Cliente', password: 'una-contrasena-larga-1', role: 'admin' },
    })
    expect(response.status()).toBe(201)

    try {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: created } },
      })
      expect(docs.map((doc) => doc.role)).toEqual(['admin'])
    } finally {
      await payload.delete({ collection: 'users', where: { email: { equals: created } } })
    }
  })

  test('el superadministrador tiene el enlace a la suscripción', async ({ page }) => {
    await login({ page, user: superUser })
    await expect(
      page.getByTestId('dashboard-locales').locator('a[href="/admin/globals/subscription"]'),
    ).toBeVisible()
  })
})
