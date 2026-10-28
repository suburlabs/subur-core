import { expect, test } from '@playwright/test'

import { dismissConsent } from './helpers/consent'

// Les pàgines de la demo en l'idioma per defecte (ca).
const pages = ['/ca', '/ca/serveis', '/ca/contacte', '/ca/privacitat']

test.describe('responsive layout', () => {
  test.use({ viewport: { height: 844, width: 390 } })

  for (const path of pages) {
    test(`${path} has no horizontal overflow on a phone`, async ({ page }) => {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('the mobile menu opens as a sheet with links and languages', async ({ page }) => {
    await page.goto('/ca')
    // The c15t consent banner card also carries `role="dialog"`; dismiss it
    // first so the unqualified `getByRole('dialog')` below matches only the
    // mobile menu sheet (see tests/e2e/helpers/consent.ts).
    await dismissConsent(page)
    await page.getByRole('button', { name: 'Menú' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Serveis' })).toBeVisible()
    await expect(dialog.getByRole('radio', { name: 'Català' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('navigating from the mobile menu closes it', async ({ page }) => {
    await page.goto('/ca')
    // Same ambiguity as above: without dismissing the banner first, the
    // consent banner card's own `role="dialog"` keeps `getByRole('dialog')`
    // matching two elements, and the assertion below would see the banner
    // still open even after the sheet itself has closed.
    await dismissConsent(page)
    await page.getByRole('button', { name: 'Menú' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Contacte' }).click()
    await expect(page).toHaveURL(/\/ca\/contacte$/)
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('scroll hero', () => {
  test('without JS, the hero is four ordinary sections, each with its own photo', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/ca')
    const hero = page.locator('[data-block="scrollHero"]')
    await expect(hero.locator('h1')).toBeVisible()
    await expect(hero.locator('h2')).toHaveCount(3)
    for (const heading of await hero.locator('h2').all()) {
      await expect(heading).toBeVisible()
    }
    const beats = hero.locator('[data-beat]')
    await expect(beats).toHaveCount(4)
    for (const beat of await beats.all()) {
      await expect(beat.locator('img')).toHaveCount(1)
    }
    await context.close()
  })

  test('the hero is four ordinary sections, each with its own distinct photo', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { height: 900, width: 1440 } })
    const page = await context.newPage()
    await page.goto('/ca')
    const hero = page.locator('[data-block="scrollHero"]')
    const beats = hero.locator('[data-beat]')
    await expect(beats).toHaveCount(4)

    const srcs = await Promise.all(
      (await beats.all()).map(async (beat) => {
        const image = beat.locator('img')
        await expect(image).toHaveCount(1)
        const src = await image.getAttribute('src')
        if (!src) throw new Error('beat image has no src')
        return new URL(src, page.url()).searchParams.get('url') ?? src
      }),
    )
    // Regression guard: this project once shipped two near-identical hero
    // stills and nobody noticed because the old scroll mechanism hid the
    // seam. These four images are now the stage's own still layer (the
    // base under the film, and the whole story under reduced motion) — so
    // they must be four distinct files.
    expect(new Set(srcs).size).toBe(4)
    await context.close()
  })

  test('the primary actions are visible in the first viewport', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 })
    await page.goto('/ca')
    const hero = page.locator('[data-block="scrollHero"]')
    const beat0 = hero.locator('[data-beat="0"]')
    await expect(beat0.getByRole('link', { name: 'Escriviu-nos' })).toBeInViewport()
    await expect(beat0.getByRole('link', { name: 'Truqueu-nos' })).toBeInViewport()
  })
})

test.describe('hero film', () => {
  test('the stage is pinned from the first paint and the film advances with scroll', async ({ browser }) => {
    test.setTimeout(60_000)
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    // A la demo, el film és petit i local: l'estat `loading` dura uns mil·lisegons i l'assert no el veuria mai. Es
    // reté la baixada un segon perquè l'estat es pugui observar (a l'arrel, el film real ja trigava prou).
    await page.route('**/film*.mp4', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.continue()
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    const header = page.locator('[data-site-header]')
    const headerHeight = await header.evaluate((el) => el.getBoundingClientRect().height)

    // Escenari fixat des del primer fotograma, just sota la capçalera
    // `sticky`: `calc(100svh - var(--header-h))`, no 100svh sencer (que el
    // faria començar sota la capçalera i empenyeria el carril fora del
    // primer viewport).
    const stageHeight = await stage.evaluate((el) => el.getBoundingClientRect().height)
    expect(Math.abs(stageHeight - (900 - headerHeight))).toBeLessThanOrEqual(2)

    // El carril (i per tant l'espiral i la barra de progrés) han de ser
    // visibles al primer viewport, sense fer scroll.
    const railBox = await page.locator('.hero-rail').boundingBox()
    expect(railBox).not.toBeNull()
    expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(901)

    await expect(stage).toHaveAttribute('data-hero-state', 'loading', { timeout: 5_000 })
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })

    const video = page.locator('[data-hero-film]')
    await expect
      .poll(async () => Number(await video.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)

    await page.mouse.wheel(0, 1800)
    await expect
      .poll(async () => Number((await stage.getAttribute('data-hero-progress')) ?? '0'))
      .toBeGreaterThan(0.2)

    // Un cop fixat, l'escenari no pot lliscar sota la capçalera: el seu
    // marge superior s'ha de mantenir a l'alçada de la capçalera, no a 0.
    const pinnedTop = await stage.evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs(pinnedTop - headerHeight)).toBeLessThanOrEqual(2)

    const active = page.locator('[data-hero-rail-item][data-active="true"]')
    await expect(active).toHaveCount(1)
    await context.close()
  })

  test('beat 0 CTAs stay clickable before the film has finished loading', async ({
    baseURL,
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.goto('/ca')
    // Clicat de seguida, sense esperar cap estat ni cap event de xarxa: el
    // rètol del beat 0 ha de ser interactiu des del primer fotograma (el
    // servidor ja hi renderitza `data-active="true"`), no només un cop GSAP
    // l'hagi marcat actiu — independentment de si el film ja ha arribat.
    // Es limita al beat 0 explícitament perquè n'hi ha un altre
    // "Escriviu-nos" al beat 3 (opac 0, fora de `pointer-events`, però
    // present a l'arbre d'accessibilitat).
    const cta = page.getByRole('link', { name: 'Escriviu-nos' }).first()
    await expect(cta).toHaveAttribute('href', '/ca/contacte')

    // Comprova que res es dibuixa per sobre del CTA al punt exacte on cauria
    // el clic (el `<video>`, opac 0 però igualment interactiu per defecte,
    // seria el sospitós si el `pointer-events: none` del beat no s'hagués
    // aixecat encara): el propi `elementFromPoint` ha de trobar el rètol.
    const box = await cta.boundingBox()
    const hit = await page.evaluate(
      ({ x, y }) => (document.elementFromPoint(x, y) as HTMLAnchorElement | null)?.href,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    )
    // L'adreça surt del `baseURL` configurat, no d'un port escrit a mà: així
    // la prova continua valent si el servidor de proves escolta en un altre.
    expect(hit).toBe(new URL('/ca/contacte', baseURL).href)

    await cta.click()
    await expect(page).toHaveURL(/\/ca\/contacte$/, { timeout: 10_000 })
    await context.close()
  })

  test('while the film downloads, the rail names what loads and how much is left', async ({ browser }) => {
    // Alternativa B (2026-09-25): el moment de càrrega és el filet del carril
    // que passa a ombra freda i s'omple de blau, més una etiqueta amb el
    // percentatge en la llengua de la pàgina. Es reté el film perquè
    // l'estat `loading` duri prou per mesurar-lo.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      ;(window as typeof window & { __HERO_LCP_TIMEOUT_MS__?: number }).__HERO_LCP_TIMEOUT_MS__ = 0
    })
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/film*.mp4', async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'loading', { timeout: 5_000 })
    await page.evaluate(() => document.fonts.ready)

    const loader = page.locator('.hero-rail__loader')
    await expect(loader).toContainText('Carregant la pel·lícula')
    await expect(loader.locator('[data-hero-progress-label]')).toHaveText(/^0\s?%$/)
    await expect.poll(async () => Number(await loader.evaluate((el) => getComputedStyle(el).opacity))).toBe(1)

    // El filet del carril és d'ombra freda mentre carrega, i el blau que
    // l'omple contrasta prou (≥3:1, no text) per llegir-s'hi a sobre.
    const rail = page.locator('.hero-rail')
    const colours = await rail.evaluate((el) => {
      const railStyle = getComputedStyle(el)
      const bar = el.querySelector('[data-hero-progress-bar]') as HTMLElement
      const barStyle = getComputedStyle(bar)
      return { bar: barStyle.backgroundColor, barOpacity: barStyle.opacity, border: railStyle.borderTopColor }
    })
    // `--secondary` i `--primary` del tema clar de la demo (#e3e7e1 i #1f5a3d).
    expect(colours.border).toBe('rgb(227, 231, 225)')
    expect(colours.bar).toBe('rgb(31, 90, 61)')
    expect(colours.barOpacity).toBe('1')

    release()
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })
    await expect(loader.locator('[data-hero-progress-label]')).toHaveText(/^100\s?%$/)
    await expect.poll(async () => Number(await loader.evaluate((el) => getComputedStyle(el).opacity))).toBe(0)
    await expect.poll(async () => await rail.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(
      'rgb(31, 90, 61)',
    )
    await context.close()
  })

  test('when playback is refused (low power mode), the stage keeps the stills until the first gesture', async ({
    browser,
  }) => {
    // Safari amb el mode de baix consum del Mac o de l'iPad
    // (`RequireUserGestureForVideoDueToLowPowerMode`): `play()` es rebutja
    // amb NotAllowedError i un vídeo que mai s'ha reproduït no pinta cap
    // fotograma cercat — es veuria el `poster` congelat. Es simula
    // rebutjant `play()` fins al primer `pointerdown` (el gest que
    // desbloqueja WebKit), i es comprova que l'escenari es queda amb les
    // stills i passa a `playing` només després del gest.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    // Cap funció amb nom aquí dins: `tsx` (amb `keepNames`) l'embolcalla amb
    // un ajudant `__name` que no arriba al navegador, l'script d'inici llança
    // ReferenceError abans d'instal·lar l'override i el test passa a
    // comprovar el navegador sense simulació.
    await page.addInitScript(() => {
      let allowed = false
      window.addEventListener('pointerdown', () => {
        allowed = true
      })
      const originalPlay = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        if (!allowed) {
          return Promise.reject(new DOMException('The request is not allowed', 'NotAllowedError'))
        }
        return originalPlay.call(this)
      }
    })
    // A la demo, el film és petit i local: l'estat `loading` dura uns mil·lisegons i l'assert no el veuria mai. Es
    // reté la baixada un segon perquè l'estat es pugui observar (a l'arrel, el film real ja trigava prou).
    await page.route('**/film*.mp4', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await route.continue()
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    const video = page.locator('[data-hero-film]')
    await expect(stage).toHaveAttribute('data-hero-state', 'loading', { timeout: 5_000 })
    // El film arriba i es cerca, però `play()` es rebutja: stills, no un
    // pòster congelat a opacitat 1.
    await expect(stage).toHaveAttribute('data-hero-state', 'stills', { timeout: 30_000 })
    await page.waitForTimeout(1_000)
    await expect(stage).toHaveAttribute('data-hero-state', 'stills')
    expect(Number(await video.evaluate((el) => getComputedStyle(el).opacity))).toBe(0)

    // Primer gest: WebKit ja deixa reproduir, el film es revela.
    await page.mouse.click(1400, 450)
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 5_000 })
    await expect
      .poll(async () => Number(await video.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)
    await context.close()
  })

  test('a film that arrives after a shortened timeout still brings the stage to playing', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    // Ganxo de test només: escurça el timeout de 20s i el d'espera del LCP
    // (vegeu Film.client.tsx), perquè aquesta prova no depengui de quan el
    // navegador enregistri realment el Largest Contentful Paint.
    await page.addInitScript(() => {
      ;(window as typeof window & { __HERO_LOAD_TIMEOUT_MS__?: number }).__HERO_LOAD_TIMEOUT_MS__ = 500
      ;(window as typeof window & { __HERO_LCP_TIMEOUT_MS__?: number }).__HERO_LCP_TIMEOUT_MS__ = 0
    })
    await page.route('**/film*.mp4', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      await route.continue()
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    const section = page.locator('[data-block="scrollHero"]')
    // En expirar el vigilant, l'escenari deixa d'anunciar càrrega...
    await expect(stage).toHaveAttribute('data-hero-state', 'stills', { timeout: 2_000 })
    await expect(section).toHaveAttribute('aria-busy', 'false')
    // ...però la baixada no s'avorta: el film arriba igualment (a ~3s) i
    // l'escenari passa a `playing` amb el film al fotograma de l'scroll.
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 15_000 })
    const video = page.locator('[data-hero-film]')
    await expect
      .poll(async () => Number(await video.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)
    await context.close()
  })

  test('a seek that never completes still falls back to the stills state', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    // I2: la descàrrega arriba (`loadeddata`), però el `seek` fins al punt
    // d'scroll no es completa mai — el forat que tapa el watchdog re-armat
    // (`seekTimeout` a Film.client.tsx). Es simula fent que `currentTime`
    // mai s'apropi al valor demanat: el getter torna sempre -1, de manera
    // que `seekToProgress` pren sempre la branca que espera `seeked` (mai
    // pren la drecera d'`onReady` immediat) i el `set` no fa res, així que
    // `seeked` no es dispara mai.
    await page.addInitScript(() => {
      ;(window as typeof window & { __HERO_SEEK_TIMEOUT_MS__?: number }).__HERO_SEEK_TIMEOUT_MS__ = 300
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get() {
          return -1
        },
        set() {
          // No-op deliberat: mai es dispara `seeked`.
        },
      })
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'loading', { timeout: 5_000 })
    await expect(stage).toHaveAttribute('data-hero-state', 'stills', { timeout: 10_000 })
    await context.close()
  })

  test('regression: the seek watchdog never fires once the film is already playing', async ({ browser }) => {
    // En una xarxa ràpida, `seeked` (i per tant `onReady`) arriba abans que
    // `loadeddata` — l'ordre entre tots dos no el garanteix cap
    // especificació. Sense el flag `ready` a Film.client.tsx, el listener de
    // `loadeddata` armava igualment el watchdog del `seek` (I2) encara que
    // l'escenari ja fos `playing`, i el temporitzador apagava el film pocs
    // segons després sense que ningú l'hagués cancel·lat. S'escurça el
    // timeout amb el ganxo de test perquè la prova no hagi d'esperar 5 s
    // reals de producció, i es comprova que sobrevius folgadament més enllà
    // d'aquesta finestra.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      ;(window as typeof window & { __HERO_SEEK_TIMEOUT_MS__?: number }).__HERO_SEEK_TIMEOUT_MS__ = 500
    })
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })

    // Folgadament més enllà del timeout escurçat (500 ms): si el watchdog
    // s'hagués tornat a armar en `loadeddata`, l'escenari ja hauria caigut a
    // `stills` molt abans d'arribar aquí.
    await page.waitForTimeout(3_000)
    await expect(stage).toHaveAttribute('data-hero-state', 'playing')

    const video = page.locator('[data-hero-film]')
    await expect
      .poll(async () => Number(await video.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)
    await context.close()
  })

  test('regression: repaints the film after the tab comes back to the foreground', async ({ browser }) => {
    // Safari, en segon pla, deixa de presentar fotogrames nous d'un <video>
    // aturat; `resumePresentation` (Film.client.tsx) escolta
    // `visibilitychange`/`pageshow` i força un cicle play/pause en tornar
    // visible. El defecte real (el fotograma es queda congelat mentre
    // `currentTime` continua avançant) no es pot reproduir en
    // automatització: cap navegador headless suspèn realment la
    // decodificació d'un vídeo en segon pla, ni Chromium ni WebKit — vegeu
    // l'informe. Aquesta prova només verifica l'efecte observable del propi
    // gestor, disparant `visibilitychange` a mà (Playwright no pot commutar
    // `document.visibilityState` de debò): que en tornar «visible» no deixa
    // el vídeo reproduint-se sol i que l'scrub segueix funcionant després.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })

    const video = page.locator('[data-hero-film]')
    await page.mouse.wheel(0, 900)
    // `scrub: 0.6` fa que la timeline trigui fins a 600 ms a atrapar la
    // posició real de l'scroll: cal esperar que s'assenti del tot abans de
    // prendre cap mesura de referència, o l'últim tram d'aquest avanç
    // legítim es podria confondre amb el film reproduint-se sol.
    await page.waitForTimeout(1_000)
    const beforeHide = await video.evaluate((el) => (el as HTMLVideoElement).currentTime)

    // Amaga la pestanya i torna-la a mostrar: exactament l'event que
    // escolta `resumePresentation`, en totes dues direccions. Cal
    // sobreescriure `document.hidden` a la vegada que `visibilityState`:
    // GSAP ScrollTrigger porta el seu propi listener de `visibilitychange`
    // que mira `document.hidden` (no `visibilityState`) per decidir si cal
    // refrescar per un possible resize. Si només es commuta
    // `visibilityState`, `document.hidden` es queda a `false` tota l'estona
    // i ScrollTrigger interpreta l'event com un resize real, forçant un
    // refresc que desplaça la posició de la timeline — un fals positiu del
    // muntatge de la prova, no un efecte de `resumePresentation`.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() {
          return 'hidden'
        },
      })
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get() {
          return true
        },
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(200)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() {
          return 'visible'
        },
      })
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get() {
          return false
        },
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // L'escenari es manté playing i, un cop assentat el cicle play/pause, el
    // vídeo es queda aturat — mai s'ha de veure reproduint-se sol.
    await expect(stage).toHaveAttribute('data-hero-state', 'playing')
    await expect.poll(async () => video.evaluate((el) => (el as HTMLVideoElement).paused)).toBe(true)
    await expect
      .poll(async () => Number(await video.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)

    // Sense tocar l'scroll, `currentTime` no avança sol.
    const settled = await video.evaluate((el) => (el as HTMLVideoElement).currentTime)
    await page.waitForTimeout(500)
    const stillSettled = await video.evaluate((el) => (el as HTMLVideoElement).currentTime)
    expect(Math.abs(stillSettled - settled)).toBeLessThan(0.05)

    // I l'scrub segueix avançant `currentTime` amb normalitat després.
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(300)
    const afterScroll = await video.evaluate((el) => (el as HTMLVideoElement).currentTime)
    expect(afterScroll).toBeGreaterThan(beforeHide)

    await context.close()
  })

  test('reduced motion never downloads the film and still scrolls through the stage', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    const requested: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('film')) requested.push(request.url())
    })
    await page.goto('/ca')
    await page.waitForLoadState('networkidle')
    expect(requested).toEqual([])

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'stills')

    const firstPhoto = page.locator('[data-beat="0"] [data-beat-photo]')
    const lastPhoto = page.locator('[data-beat="3"] [data-beat-photo]')
    await expect
      .poll(async () => Number(await firstPhoto.evaluate((el) => getComputedStyle(el).opacity)))
      .toBe(1)

    await page.mouse.wheel(0, 5000)
    await expect
      .poll(async () => Number((await stage.getAttribute('data-hero-progress')) ?? '0'))
      .toBeGreaterThan(0.9)

    const active = page.locator('[data-hero-rail-item][data-active="true"]')
    await expect(active).toHaveCount(1)
    await expect
      .poll(async () => Number(await lastPhoto.evaluate((el) => getComputedStyle(el).opacity)))
      .toBeGreaterThan(0)
    await context.close()
  })

  test('B1 regression: at 2560×900 the active beat plaque stays inside the stage', async ({ browser }) => {
    // Abans de la correcció, `grid-template: 1fr / 1fr` deixava que la
    // proporció intrínseca del film (1276×720) estirés la fila fins a
    // 1444,5 px a 2560 px d'ample: el rètol, centrat en aquesta alçada
    // fantasma, queia per sota dels 900 px reals i quedava tallat.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 2560 },
    })
    const page = await context.newPage()
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    const stageBox = await stage.boundingBox()
    expect(stageBox).not.toBeNull()
    expect(stageBox!.height).toBeLessThanOrEqual(901)

    const plaque = page.locator('[data-beat="0"][data-active="true"] .plaque')
    const plaqueBox = await plaque.boundingBox()
    expect(plaqueBox).not.toBeNull()
    expect(plaqueBox!.y).toBeGreaterThanOrEqual(stageBox!.y)
    expect(plaqueBox!.y + plaqueBox!.height).toBeLessThanOrEqual(stageBox!.y + stageBox!.height + 1)

    await expect(page.getByRole('link', { name: 'Escriviu-nos' }).first()).toBeInViewport()
    await context.close()
  })

  test('B2 regression: after a locale change the stage keeps its height and reaches playing', async ({ browser }) => {
    // Abans de la correcció, l'atribut `[data-js]` desapareixia de `<html>`
    // en la navegació de client entre idiomes (el layout arrel es tornava a
    // renderitzar) i l'escenari es desmuntava visualment (1444,5→5146 px,
    // `display: block`) mentre GSAP el continuava fixant.
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    const header = page.locator('[data-site-header]')
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })
    const headerHeight = await header.evaluate((el) => el.getBoundingClientRect().height)

    // A la demo, de l'idioma per defecte (ca) al castellà.
    await page.getByRole('banner').getByRole('radio', { name: 'Español' }).click()
    await expect(page).toHaveURL(/\/es$/)

    await expect(stage).toHaveCSS('display', 'grid')
    await expect
      .poll(async () => stage.evaluate((el) => el.getBoundingClientRect().height))
      .toBeLessThanOrEqual(900 - headerHeight + 2)
    await expect(stage).toHaveAttribute('data-hero-state', 'playing', { timeout: 30_000 })
    await context.close()
  })

  test('a failing film request falls back to the stills state, never to the four sections', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { height: 900, width: 1440 },
    })
    const page = await context.newPage()
    await page.route('**/film*.mp4', (route) => route.abort())
    await page.goto('/ca')

    const stage = page.locator('[data-hero-stage]')
    await expect(stage).toHaveAttribute('data-hero-state', 'stills', { timeout: 30_000 })
    // Mai torna a quatre seccions: l'escenari es manté fixat i el carril
    // opac, que només existeix en mode escenari, es queda visible.
    await expect(page.locator('.hero-rail')).toBeVisible()
    const headerHeight = await page.locator('[data-site-header]').evaluate((el) => el.getBoundingClientRect().height)
    const stageHeight = await stage.evaluate((el) => el.getBoundingClientRect().height)
    expect(Math.abs(stageHeight - (900 - headerHeight))).toBeLessThanOrEqual(2)
    await context.close()
  })
})

/**
 * El crèdit «Web feta per Subur» al peu (spec §0.5; C69): la demo el té perquè el seu `.subur/` diu `footerCredit: true`
 * i el seed l'escriu al global `subscription`. Un enllaç a subur.dev, amb el text de cada idioma.
 */
test.describe('footer credit', () => {
  for (const [locale, text] of [
    ['ca', 'Web feta per Subur'],
    ['es', 'Web hecha por Subur'],
    ['en', 'Website by Subur'],
  ] as const) {
    test(`/${locale} credits Subur in the footer`, async ({ page }) => {
      await page.goto(`/${locale}`)
      const credit = page.locator('footer [data-subur-credit]')
      await expect(credit).toHaveText(text)
      await expect(credit.locator('a[href="https://subur.dev"]')).toHaveText('Subur')
    })
  }
})
