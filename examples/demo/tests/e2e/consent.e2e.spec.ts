import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Comprovació del consentiment amb un perfil net (c15t en mode `hosted`
 * contra el backend propi de la web a `/api/c15t`, vegeu
 * src/providers/Consent.tsx). Cada `test()` de Playwright obre un context
 * nou, és a dir un perfil net, així que no cal preparar res abans de cada
 * cas.
 *
 * Els selectors fan servir els rols i els textos reals que c15t pinta a
 * `/ca`, l'idioma per defecte de la demo (comprovats al navegador abans
 * d'escriure'ls, no endevinats):
 * - Bàner: `dialog` amb nom accessible «Galetes» i botons «Rebutja»,
 *   «Preferències» i «Accepta».
 * - Diàleg de preferències: `dialog` amb nom «Preferències de galetes»,
 *   categoria «Estrictament necessàries» i botons «Rebutja», «Accepta» i
 *   «Desa».
 * - Disparador permanent del peu: botó «Preferències de galetes» (el mateix
 *   text que el títol del diàleg; per això totes les cerques de més avall
 *   van amb `exact: true` o dins d'un contenidor concret).
 *
 * Persistència real, mesurada al navegador (no endevinada): en mode
 * `hosted` la decisió es desa alhora a la galeta `c15t` i a
 * `localStorage['c15t']` (node_modules/c15t/dist/index.js,
 * `saveConsentToStorage`), mai només en una de les dues, i a més es
 * sincronitza amb el backend propi (`/api/c15t`, Tasca 1); si el backend no
 * respon, c15t passa a `offline` i ho torna a provar més tard (vegeu
 * node_modules/@c15t/nextjs/docs/shared/concepts/client-modes.md).
 */

const bannerLocator = (page: Page): Locator => page.getByRole('dialog', { name: 'Galetes' })
const preferencesDialogLocator = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Preferències de galetes' })

async function openPreferencesFromFooter(page: Page): Promise<Locator> {
  await page.locator('[data-site-footer]').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Preferències de galetes' }).click()
  const dialog = preferencesDialogLocator(page)
  await expect(dialog).toBeVisible()
  return dialog
}

async function readConsentRecord(page: Page): Promise<{ consents: Record<string, boolean>; consentInfo: { time: number } } | null> {
  const raw = await page.evaluate(() => localStorage.getItem('c15t'))
  return raw ? JSON.parse(raw) : null
}

type Rect = { x: number; y: number; width: number; height: number }

/** Solapamiento en los dos ejes a la vez: un hueco vertical con las cajas
 * desalineadas en horizontal no cuenta como tapado, y viceversa. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

test.describe('consentimiento: perfil limpio', () => {
  test('1) antes de consentir, solo hay peticiones propias y como mucho la cookie NEXT_LOCALE', async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('falta baseURL en la config de Playwright')
    const ownHost = new URL(baseURL).host

    // Registrado ANTES de `goto`, para que ninguna petición temprana escape
    // al registro.
    const foreignRequests: string[] = []
    page.on('request', (request) => {
      let url: URL
      try {
        url = new URL(request.url())
      } catch {
        return
      }
      // Los blobs de vídeo (el film del hero) y los `data:` son locales al
      // navegador, no peticiones de red a un tercero.
      if (url.protocol === 'blob:' || url.protocol === 'data:') return
      if (url.host !== ownHost) foreignRequests.push(`${request.method()} ${request.url()}`)
    })

    await page.goto('/ca')
    await expect(bannerLocator(page)).toBeVisible()

    // `networkidle` nunca llega en esta web: el hero descarga el film con
    // `fetch` y lo monta como `blob:` (ver tests/e2e/contrast.e2e.spec.ts),
    // y esa descarga mantiene la red "ocupada" más allá de cualquier
    // timeout razonable. `load` más un margen es suficiente para que las
    // imágenes, fuentes y el propio film hayan empezado a pedirse.
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)

    expect(
      foreignRequests,
      `se han encontrado peticiones a un dominio ajeno a ${ownHost} antes de consentir:\n${foreignRequests.join('\n')}`,
    ).toEqual([])

    const cookies = await context.cookies()
    const unexpectedCookies = cookies.filter((cookie) => cookie.name !== 'NEXT_LOCALE')
    expect(
      unexpectedCookies,
      `cookies inesperadas antes de consentir: ${unexpectedCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(', ')}`,
    ).toEqual([])

    // Estado real medido (ver informe de la Tarea 5): en un perfil limpio,
    // sin haber decidido nada todavía, ni `localStorage` ni
    // `sessionStorage` tienen ninguna clave — ni la del propio c15t (que
    // solo se escribe al decidir) ni la del tema (next-themes solo escribe
    // al cambiarlo, nunca en la carga inicial). Es una comprobación
    // estricta a propósito: si algún día algo empieza a escribir ahí antes
    // de consentir, esta prueba debe encenderse.
    const storageKeys = await page.evaluate(() => ({
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
    }))
    expect(storageKeys.localStorage, 'localStorage antes de consentir').toEqual([])
    expect(storageKeys.sessionStorage, 'sessionStorage antes de consentir').toEqual([])
  })

  test('2) aceptar: el bàner desaparece, la decisión se guarda y no vuelve a salir al recargar', async ({
    page,
    context,
  }) => {
    await page.goto('/ca')
    const banner = bannerLocator(page)
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Accepta', exact: true }).click()
    await expect(banner).toHaveCount(0)

    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'c15t'), 'debe guardarse la cookie c15t').toBeTruthy()

    const record = await readConsentRecord(page)
    expect(record, 'debe guardarse localStorage["c15t"]').toBeTruthy()
    expect(record!.consents.necessary).toBe(true)

    await page.reload()
    await expect(bannerLocator(page)).toHaveCount(0)
  })

  test('3) rechazar: mismo comportamiento, y sigue sin activarse ningún recurso opcional', async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('falta baseURL en la config de Playwright')
    const ownHost = new URL(baseURL).host
    const foreignRequests: string[] = []
    page.on('request', (request) => {
      let url: URL
      try {
        url = new URL(request.url())
      } catch {
        return
      }
      if (url.protocol === 'blob:' || url.protocol === 'data:') return
      if (url.host !== ownHost) foreignRequests.push(`${request.method()} ${request.url()}`)
    })

    await page.goto('/ca')
    const banner = bannerLocator(page)
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Rebutja', exact: true }).click()
    await expect(banner).toHaveCount(0)

    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'c15t'), 'debe guardarse la cookie c15t').toBeTruthy()

    const record = await readConsentRecord(page)
    expect(record, 'debe guardarse localStorage["c15t"]').toBeTruthy()

    await page.reload()
    await expect(bannerLocator(page)).toHaveCount(0)

    // Hoy la web no tiene ninguna categoría opcional (solo `necessary`), así
    // que rechazar no puede activar nada de todos modos. Esta comprobación
    // deja fijado ese comportamiento para el día en que exista una
    // categoría opcional: si entonces algo opcional se dispara pese al
    // rechazo, esta prueba debe encenderse.
    await page.waitForLoadState('load')
    await page.waitForTimeout(1000)
    expect(
      foreignRequests,
      `peticiones a un dominio ajeno tras rechazar:\n${foreignRequests.join('\n')}`,
    ).toEqual([])
  })

  test('4) preferencias: el diálogo se abre desde el pie, muestra la categoría necesaria y se puede guardar', async ({
    page,
  }) => {
    await page.goto('/ca')
    const banner = bannerLocator(page)
    await expect(banner).toBeVisible()
    // El disparador del pie está pensado para reabrir el diálogo una vez ya
    // se ha decidido (ver src/components/CookiePreferencesTrigger): con el
    // bàner todavía visible, ambos ocupan la misma franja inferior fija y
    // el bàner puede interceptar el clic según la altura del viewport. Se
    // rechaza primero para que este caso compruebe de verdad el
    // disparador del pie, no el botón «Preferències» del propio bàner (eso
    // ya lo prueban los demás casos al abrir el diálogo).
    await banner.getByRole('button', { name: 'Rebutja', exact: true }).click()
    await expect(banner).toHaveCount(0)

    const dialog = await openPreferencesFromFooter(page)
    await expect(dialog.getByRole('heading', { name: 'Estrictament necessàries' })).toBeVisible()
    const toggle = dialog.getByRole('switch', { name: 'Estrictament necessàries' })
    // La única categoría es obligatoria: siempre activa y sin poder
    // desactivarse.
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(toggle).toBeDisabled()

    await dialog.getByRole('button', { name: 'Desa', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('5) retirada: tras aceptar, se reabre desde el pie, se cambia la decisión y se guarda; al recargar se mantiene la nueva', async ({
    page,
  }) => {
    await page.goto('/ca')
    const banner = bannerLocator(page)
    // En modo `hosted` cada decisión se guarda en `localStorage` de forma
    // síncrona y LUEGO se sincroniza con el backend (`POST
    // /api/c15t/subjects`, ver src/providers/Consent.tsx); al terminar esa
    // sincronización el cliente reescribe el registro (comprobado en el
    // navegador: el `time` cambia una segunda vez, unos cientos de ms
    // después del clic, cuando llega la respuesta). Sin esperar esa
    // respuesta, leer el registro justo después del clic captura un valor
    // que el propio cliente todavía va a sobrescribir — una carrera, no un
    // comportamiento real que haya que fijar. Se espera esa respuesta antes
    // de leer, para comparar el registro ya asentado.
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/c15t/subjects')),
      banner.getByRole('button', { name: 'Accepta', exact: true }).click(),
    ])
    await expect(banner).toHaveCount(0)
    const firstRecord = await readConsentRecord(page)
    expect(firstRecord).toBeTruthy()

    const dialog = await openPreferencesFromFooter(page)
    // La categoría `necessary` es obligatoria y siempre queda en `true` la
    // decida quien la decida (node_modules/c15t/dist/index.js,
    // `saveConsents`: para el tipo `necessary` conserva `defaultValue` en
    // vez de ponerlo a `false`), así que «cambiar la decisión» no puede
    // verse en el valor de esa categoría. Con `measurement` ya como segunda
    // categoría (Tasca 2 del Pla H2), el cambio si es observable en su
    // valor además de en la marca de tiempo: se elige esta vez el botón
    // contrario («Rebutja» tras haber aceptado antes) y esa nueva decisión
    // persiste tras recargar.
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/c15t/subjects')),
      dialog.getByRole('button', { name: 'Rebutja', exact: true }).click(),
    ])
    await expect(dialog).toHaveCount(0)

    const secondRecord = await readConsentRecord(page)
    expect(secondRecord).toBeTruthy()
    expect(secondRecord!.consentInfo.time).toBeGreaterThan(firstRecord!.consentInfo.time)
    expect(firstRecord!.consents.measurement).toBe(true)
    expect(secondRecord!.consents.measurement).toBe(false)

    await page.reload()
    await expect(bannerLocator(page)).toHaveCount(0)
    const afterReload = await readConsentRecord(page)
    expect(afterReload!.consentInfo.time).toBe(secondRecord!.consentInfo.time)
  })

  test('6) tras decidir, navegar a otra página con un enlace no vuelve a mostrar el bàner', async ({ page }) => {
    await page.goto('/ca')
    const banner = bannerLocator(page)
    await banner.getByRole('button', { name: 'Accepta', exact: true }).click()
    await expect(banner).toHaveCount(0)

    await page.getByRole('banner').getByRole('link', { name: 'Serveis' }).click()
    await expect(page).toHaveURL(/\/ca\/serveis$/)
    await expect(bannerLocator(page)).toHaveCount(0)
  })

  test('7) teclado: Tab llega a los botones del bàner y Enter actúa; dentro del diálogo, Escape lo cierra', async ({
    page,
  }) => {
    await page.goto('/ca')
    await expect(bannerLocator(page)).toBeVisible()

    // Tab hasta enfocar «Rebutja» (el primer botón del bàner, ver `layout`
    // en src/providers/Consent.tsx) y activarlo con Enter, sin ratón.
    let reached = false
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim())
      if (focusedText === 'Rebutja') {
        reached = true
        break
      }
    }
    expect(reached, 'Tab debe poder alcanzar el botón «Rebutja» del bàner').toBe(true)
    await page.keyboard.press('Enter')
    await expect(bannerLocator(page)).toHaveCount(0)

    const dialog = await openPreferencesFromFooter(page)
    const beforeEscape = await readConsentRecord(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // Cerrar con Escape no debe registrar ninguna decisión nueva («cerrar
    // no es aceptar»): ver src/providers/Consent.tsx,
    // `EscapeClosesPreferencesDialog` — usa `setActiveUI('none')`, nunca
    // `saveConsents`.
    const afterEscape = await readConsentRecord(page)
    expect(afterEscape).toEqual(beforeEscape)

    // El foco no debe perderse en <body>: debe volver al control que abrió
    // el diálogo (aquí, el disparador del peu).
    await expect(page.getByRole('button', { name: 'Preferències de galetes' })).toBeFocused()
  })

  test('8) pantalla estrecha: a 390 px el bàner no genera scroll horizontal ni tapa los botones de contacto del hero', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { height: 844, width: 390 },
    })
    const page = await context.newPage()
    await page.goto('/ca')
    await expect(bannerLocator(page)).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // Solo un beat del hero está activo a la vez; los demás repiten los
    // mismos CTAs a `opacity: 0` (ver `[data-beat][data-active]`, el mismo
    // selector que usa tests/e2e/layout.e2e.spec.ts). Hay que comparar la
    // caja del CTA realmente visible, y en los dos ejes a la vez: un hueco
    // vertical con las cajas desalineadas en horizontal (o viceversa) no
    // sería un tapado real.
    const activeBeat = page.locator('[data-beat][data-active="true"]')
    const bannerBox = await bannerLocator(page).boundingBox()
    expect(bannerBox).not.toBeNull()

    for (const name of ['Escriviu-nos', 'Truqueu-nos']) {
      const ctaBox = await activeBeat.getByRole('link', { name }).boundingBox()
      expect(ctaBox, `debe existir un CTA visible «${name}» en el beat activo`).not.toBeNull()
      expect(rectsOverlap(ctaBox!, bannerBox!), `el bàner tapa el CTA «${name}»`).toBe(false)
    }

    await context.close()
  })

  test('el diálogo de preferencias ofrece la categoría de medición y la guarda en el backend', async ({
    page,
    request,
  }) => {
    await page.goto('/ca')
    await bannerLocator(page).getByRole('button', { name: 'Preferències', exact: true }).click()
    const dialog = preferencesDialogLocator(page)
    await expect(dialog.getByText('Mesurament')).toBeVisible()
    await dialog.getByRole('button', { name: 'Accepta', exact: true }).click()
    await expect(bannerLocator(page)).toBeHidden()
    const record = await readConsentRecord(page)
    expect(record?.consents.measurement).toBe(true)
    // El backend ha respondido: /status es público y confirma que la web lo sirve.
    expect((await request.get('/api/c15t/status')).status()).toBe(200)
  })
})
