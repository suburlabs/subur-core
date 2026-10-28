import { type APIRequestContext, expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, type TestUser } from '../helpers/seedUser'
import { dismissConsent } from './helpers/consent'
import { setSubscription } from './helpers/subscription'

const superUser: TestUser = { email: 'locales-super@subur.dev', password: 'test', role: 'superadmin' }

// El canvi passa pel servidor (REST amb sessió de superadmin), no per l'API
// local del procés de proves: només així corre el hook que llença la memòria
// cau del servidor.
const setActiveLocales = async (request: APIRequestContext, activeLocales: string[]) => {
  const login = await request.post('/api/users/login', {
    data: { email: superUser.email, password: superUser.password },
  })
  expect(login.ok()).toBe(true)
  const update = await request.post('/api/globals/subscription', { data: { activeLocales } })
  expect(update.ok()).toBe(true)
}

// A la demo, l'idioma per defecte és el català: un idioma inactiu redirigeix a `/ca`, i la llista activa reduïda és
// `['ca', 'es']`. Les visites amb `dismissConsent` són a `/ca`, on el bàner parla català.
test.describe('idiomas activos', () => {
  test.beforeAll(async ({ playwright }) => {
    await seedTestUser(superUser)
    // Sense `.subur/` (la còpia del client), el seed deixa el màxim d'idiomes a 1 i el
    // motor rebutjaria els tres actius d'aquestes proves: primer, el màxim.
    const request = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    await setSubscription(request, { maxLanguages: 3 }, superUser)
    await request.dispose()
  })

  test.afterAll(async ({ playwright }) => {
    // El `request` fixture no és disponible dins d'`afterAll` (és d'àmbit de
    // prova), però `test.info()` sí: el context propi es crea contra el
    // `baseURL` configurat al projecte, mai contra una adreça escrita a mà.
    // Amb el port fix, una execució en un altre port deixava els idiomes
    // actius escrits a la base de dades del servidor equivocat.
    const request = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await setActiveLocales(request, ['ca', 'es', 'en'])
    await request.dispose()
    await cleanupTestUser(superUser)
  })

  test('un idioma desactivado desaparece de la web y vuelve al activarlo', async ({ page, request }) => {
    await setActiveLocales(request, ['ca', 'es'])

    await page.goto('/en/contacte')
    await expect(page).toHaveURL(/\/ca\/contacte$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ca')

    await page.goto('/ca')
    await dismissConsent(page)
    // El component `ToggleGroup` (Radix) renderitza `role="radiogroup"`, no
    // `role="group"` — confirmat al navegador abans d'escriure aquesta prova.
    const switcher = page.locator('header [role="radiogroup"]').first()
    await expect(switcher.getByRole('radio', { name: 'Español' })).toBeVisible()
    await expect(switcher.getByRole('radio', { name: 'English' })).toHaveCount(0)
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)

    const sitemap = await (await request.get('/pages-sitemap.xml')).text()
    expect(sitemap).not.toContain('/en/')

    await setActiveLocales(request, ['ca', 'es', 'en'])

    const response = await page.goto('/en/contacte')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/en\/contacte$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('el modo borrador previsualiza un idioma inactivo y el selector no duplica el prefijo', async ({
    page,
    request,
  }) => {
    await setActiveLocales(request, ['ca', 'es'])

    // El bàner de consentiment és per idioma («Accepta» en català, «Accept»
    // en anglès): es descarta aquí, en català, amb la pàgina pública
    // encara en un idioma actiu — abans d'entrar en mode esborrany i navegar
    // a l'anglès, on l'ajudant `dismissConsent` (que busca «Accepta») no
    // trobaria el seu botó. Un cop descartat no torna a aparèixer en aquest
    // mateix context de navegador.
    await page.goto('/ca')
    await dismissConsent(page)

    await login({ page, user: superUser })

    const previewSecret = process.env.PREVIEW_SECRET
    if (!previewSecret) throw new Error('Falta PREVIEW_SECRET en el entorno de pruebas.')

    // `page.request` comparteix cookies amb la pestanya del navegador (a
    // diferència del fixture `request` de dalt): la cookie
    // `__prerender_bypass` que fixa aquesta ruta viatja d'aquí cap a
    // `page.goto` de seguida, sense haver-la de copiar a mà.
    await page.request.get(
      `/next/preview?path=${encodeURIComponent('/en/serveis')}&previewSecret=${previewSecret}`,
    )

    // Regla del controlador: en mode esborrany un superadmin ha de poder
    // previsualitzar un idioma encara no contractat — és el flux d'aquest
    // pla («preparar el contingut, després activar-lo») — així que aquí NO
    // hi ha redirecció, a diferència de la visita pública de dalt.
    const draftResponse = await page.goto('/en/serveis')
    expect(draftResponse?.status()).toBe(200)
    await expect(page).toHaveURL(/\/en\/serveis$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const switcher = page.locator('header [role="radiogroup"]').first()
    // `en` no és a la llista activa: el selector no l'ofereix, encara que
    // sigui l'idioma real de la pàgina que s'està previsualitzant.
    await expect(switcher.getByRole('radio', { name: 'English' })).toHaveCount(0)

    // Abans de la correcció, `LocaleSwitcher` passava la llista ACTIVA
    // (`['es','ca']`) a `switchLocalePath` en lloc del catàleg sencer; no
    // reconeixia `en` com a prefix ja present a la URL i n'afegia un altre
    // davant: `/ca/en/serveis` en lloc de `/ca/serveis`.
    await switcher.getByRole('radio', { name: 'Català' }).click()
    await expect(page).toHaveURL(/\/ca\/serveis$/)

    // Sortir del mode esborrany treu l'excepció: l'idioma inactiu torna a
    // redirigir cap al de defecte.
    await page.request.get('/next/exit-preview')
    await page.goto('/en/contacte')
    await expect(page).toHaveURL(/\/ca\/contacte$/)

    await setActiveLocales(request, ['ca', 'es', 'en'])
  })
})
