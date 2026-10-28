'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { type ReactNode, useRef } from 'react'

import type { SiteConfig } from '../../utilities/defineSiteConfig.js'
import { beatAtProgress, beatSegments } from './film.js'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** Els canvis de mida per la barra d'adreces del mòbil no han de recalcular res. */
ScrollTrigger.config({ ignoreMobileResize: true })

/** Si el film no ha arribat en 20 s, l'escenari deixa de mostrar-se «carregant»
 * (estat `stills`, `aria-busy` fora), però la baixada continua en segon pla:
 * en una línia lenta (mesurat el 2026-09-25: entre 50 i 870 KB/s cap al VPS
 * dins la mateixa hora) avortar-la llençava els megabytes ja rebuts i deixava
 * l'espectador amb les fotos per sempre. Si el film acaba arribant i la cerca
 * es completa, l'escenari passa igualment a `playing`. */
const DEFAULT_LOAD_TIMEOUT_MS = 20_000

/** Temporitzador de seguretat per a `waitForLargestContentfulPaint`: cap
 * navegador sense l'entrada `largest-contentful-paint` (Safari no en té) es
 * pot quedar esperant per sempre. */
const DEFAULT_LCP_SAFETY_TIMEOUT_MS = 2_500

/** I2: un cop `loadeddata` arriba, encara falta el `seek` fins al punt on
 * l'espectador ja hagi arribat fent scroll (`seekToProgress` → `onReady`).
 * Si `video.duration` és NaN/Infinity o el descodificador abandona la cerca
 * (Safari mòbil sota pressió de memòria), `seeked` no arriba mai i l'escenari
 * es quedaria a `loading` per sempre. Aquest segon temporitzador, més curt
 * que el de la descàrrega, és qui ho talla. */
const DEFAULT_SEEK_TIMEOUT_MS = 5_000

/** Ganxos de test només (M10): es llegeixen en desenvolupament, o en un build
 * de producció fet amb `NEXT_PUBLIC_SUBUR_E2E_HOOKS=1` (el de l'e2e del CI).
 * La variable es decideix en temps de build: si hi és, Next n'incrusta el valor
 * al bundle del client; si no hi és, no hi incrusta res i al navegador
 * `process.env` és buit. En un build fet sense la variable (la imatge, la
 * producció), cap `window.__HERO_*__` pot influir mai el que s'envia als usuaris. */
const readTestHook = (
  name: 'HERO_LCP_TIMEOUT_MS' | 'HERO_LOAD_TIMEOUT_MS' | 'HERO_SEEK_TIMEOUT_MS',
): number | undefined => {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SUBUR_E2E_HOOKS !== '1') return undefined
  return (window as unknown as Record<string, number | undefined>)[`__${name}__`]
}

/** Alçada real de la capçalera `sticky`, llegida de `--header-h` (definida en
 * `rem` a `theme.css`) en el moment del refresc: el `pin` hi enganxa
 * l'escenari perquè mai quedi per sota de la capçalera (vegeu `start` a
 * `scrollTrigger`, més avall). Es mesura la variable, no l'element, perquè
 * `invalidateOnRefresh` la torni a llegir si el breakpoint canvia (4.5rem
 * mòbil, 5.5rem des de 64rem). */
const headerHeightPx = (): number => {
  const styles = getComputedStyle(document.documentElement)
  const raw = styles.getPropertyValue('--header-h').trim()
  const value = parseFloat(raw) || 0
  const rootFontSize = parseFloat(styles.fontSize) || 16
  return raw.endsWith('rem') ? value * rootFontSize : value
}

/**
 * El poster és qui ha de guanyar el Largest Contentful Paint (Tasca 8): un
 * film de 9 MB que es pintés a sobre seu abans que el navegador n'hagués
 * assentat el píxel més gran li prendria el lloc — és exactament el que va
 * mesurar Lighthouse en una xarxa sense cap latència real, on la baixada i
 * la decodificació del film s'acabaven a temps d'entrar dins la finestra de
 * mesura del LCP. Per això la baixada del film no arrenca només amb `load`
 * + inactivitat: espera també una entrada `largest-contentful-paint` (amb
 * `buffered: true`, perquè compti encara que ja s'hagués enregistrat abans
 * de crear l'observador) o el temporitzador de seguretat, el que arribi
 * primer — els navegadors sense aquest tipus d'entrada (Safari no en té)
 * cauen només al temporitzador.
 */
const waitForLargestContentfulPaint = (timeoutMs: number, callback: () => void): (() => void) => {
  let settled = false
  let observer: PerformanceObserver | undefined

  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeoutId)
    observer?.disconnect()
    callback()
  }

  const timeoutId = window.setTimeout(finish, timeoutMs)

  try {
    observer = new PerformanceObserver(finish)
    observer.observe({ buffered: true, type: 'largest-contentful-paint' })
  } catch {
    // Navegador sense el tipus d'entrada `largest-contentful-paint`:
    // es queda només amb el temporitzador de seguretat de dalt.
  }

  return () => {
    settled = true
    window.clearTimeout(timeoutId)
    observer?.disconnect()
  }
}

/** `heroFilm` arriba per propietat del pare de servidor (`Component.tsx`, que el llegeix de `subur-site-config`). */
export function ScrollHeroFilm({ children, count, heroFilm }: { children: ReactNode; count: number; heroFilm: SiteConfig['assets']['heroFilm'] }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    (_context, contextSafe) => {
      // B2: `[data-js]` el marca un script en línia a `layout.tsx` abans de
      // la hidratació, però aquest atribut viu fora del que React coneix.
      // En una navegació de client entre idiomes, `page.tsx` es torna a
      // muntar i el layout arrel es torna a renderitzar; l'atribut
      // desapareix de `<html>` encara que aquest component sí que es torni
      // a muntar. Es reafirma aquí, síncronament amb el layout (`useGSAP`
      // corre en un efecte de layout, no en un `useEffect` tardà) i abans
      // de construir la timeline, perquè cap regla de l'escenari depengui
      // de si l'script en línia ha sobreviscut.
      document.documentElement.dataset.js = ''

      const section = root.current?.querySelector<HTMLElement>('[data-block="scrollHero"]')
      const stage = root.current?.querySelector<HTMLElement>('[data-hero-stage]')
      const video = root.current?.querySelector<HTMLVideoElement>('[data-hero-film]')
      if (!section || !stage || !video) return

      const beats = gsap.utils.toArray<HTMLElement>('[data-beat]', root.current)
      const rail = gsap.utils.toArray<HTMLElement>('[data-hero-rail-item]', root.current)
      const photos = gsap.utils.toArray<HTMLElement>('[data-beat-photo]', root.current)
      const plaques = beats
        .map((beat) => beat.querySelector<HTMLElement>('.plaque'))
        .filter((plaque): plaque is HTMLElement => plaque !== null)
      const progressBar = root.current?.querySelector<HTMLElement>('[data-hero-progress-bar]')
      const progressLabel = root.current?.querySelector<HTMLElement>('[data-hero-progress-label]')
      // El percentatge s'escriu com ho faria la llengua de la pàgina («37 %»
      // en castellà i català, «37%» en anglès): `lang` el posa el layout.
      const percent = new Intl.NumberFormat(document.documentElement.lang || undefined, {
        maximumFractionDigits: 0,
        style: 'percent',
      })

      // `contextSafe` és per als tweens que es creen molt després que aquesta
      // funció hagi acabat d'executar-se (des d'un listener de vídeo): sense
      // ell no formarien part de cap context i no es revertirien mai.
      const safe = contextSafe ?? ((fn: () => void) => fn)

      /**
       * L'escenari fixat i el seu escombrat (stills + rètols + carril) es
       * construeixen igual als dos variants de `matchMedia`: qui té moviment
       * reduït també passa les quatre escenes fent scroll, només que mai
       * n'hi arriba el film. Retorna la timeline perquè el variant amb
       * moviment hi afegeixi més tard el playhead del vídeo.
       */
      const buildStageTimeline = () => {
        beats.forEach((beat, index) => {
          beat.dataset.active = String(index === 0)
        })

        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            end: () => `+=${count * 100}%`,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              stage.dataset.heroProgress = self.progress.toFixed(2)
              const active = beatAtProgress(self.progress, count)
              rail.forEach((item, index) => {
                item.dataset.active = String(index === active)
              })
              beats.forEach((beat, index) => {
                beat.dataset.active = String(index === active)
              })
            },
            pin: stage,
            scrub: 0.6,
            // Desplaçat per l'alçada de la capçalera `sticky`: sense això
            // l'escenari es fixa a `top: 0` i queda tapat per la capçalera
            // (o hi llisca per sota) en comptes de començar just a sota seu.
            start: () => `top top+=${headerHeightPx()}`,
            trigger: section,
          },
        })

        // Fixa la durada total a 1 des del primer moment: el variant amb
        // moviment hi afegeix el playhead del vídeo més tard (un cop el
        // film és a punt) i, si la durada total canviés en aquell moment,
        // tot l'escombrat de scroll ja fet saltaria de posició.
        timeline.set({}, {}, 1)

        // El focus de teclat no ha de poder quedar-se en un beat amb
        // opacitat 0: si entra en un que no és l'actiu, es porta l'scroll
        // fins al punt on aquell beat és plenament visible.
        const handleFocusIn = (event: FocusEvent) => {
          const target = event.target
          if (!(target instanceof HTMLElement)) return
          const beat = target.closest<HTMLElement>('[data-beat]')
          if (!beat || beat.dataset.active === 'true') return
          const index = Number(beat.dataset.beat)
          const trigger = timeline.scrollTrigger
          if (!trigger) return
          const scrollTarget = trigger.start + ((index + 0.5) / count) * (trigger.end - trigger.start)
          window.scrollTo({ behavior: 'instant', top: scrollTarget })
        }
        stage.addEventListener('focusin', handleFocusIn)

        // La primera escena ha de ser visible a scroll 0 (hi viu l'h1 i els
        // dos CTA): ni el seu rètol ni la seva foto porten `fromTo` d'entrada,
        // només el rètol surt quan el seu segment s'acaba. La resta de
        // rètols entren i surten en fondut, excepte el de l'última escena,
        // que es queda; el fondut és curt (15% del segment a cada banda)
        // perquè el rètol és opac per norma — a 0.5/count cada fondut
        // ocupava mig segment i el rètol no arribava mai a opacitat plena.
        //
        // Les fotos, en canvi, només entren: la N+1 es dibuixa per sobre de
        // la N (que es queda opaca a sota), així que mai hi ha un fotograma
        // sense res per sota mentre s'encavalquen. Només `opacity`, no
        // `autoAlpha`: `autoAlpha` també commuta `visibility`, i això
        // trauria l'encapçalament, el cos i els CTA de l'arbre
        // d'accessibilitat dels beats no actius. Els quatre es queden
        // sempre al DOM i a l'arbre; qui no es veu es tapa amb
        // `pointer-events: none` (primitives.css) per no interceptar clics
        // destinats al beat visible.
        const fade = 0.15 / count
        beatSegments(count).forEach((segment, index) => {
          if (index > 0) {
            if (plaques[index]) {
              timeline.fromTo(plaques[index], { opacity: 0 }, { duration: fade, opacity: 1 }, segment.start)
            }
            if (photos[index]) {
              timeline.fromTo(photos[index], { opacity: 0 }, { duration: fade, opacity: 1 }, segment.start)
            }
          }
          if (index < count - 1 && plaques[index]) {
            timeline.to(plaques[index], { duration: fade, opacity: 0 }, segment.end - fade)
          }
        })

        void document.fonts?.ready.then(() => ScrollTrigger.refresh())

        return {
          timeline,
          teardown: () => stage.removeEventListener('focusin', handleFocusIn),
        }
      }

      const mm = gsap.matchMedia()

      // Dues condicions amb noms (no només `reduce`): `matchMedia` només
      // crida el handler quan almenys una hi coincideix, i `no-preference`
      // és qui hi coincideix la immensa majoria de vegades.
      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduce: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { reduce } = context.conditions as { motion: boolean; reduce: boolean }
          const { teardown, timeline } = buildStageTimeline()

          if (reduce) {
            // Variant stills: el mateix escenari fixat, mai es baixa el
            // film, sense indicador de càrrega.
            stage.dataset.heroState = 'stills'
            return teardown
          }

          // Variant film: l'escenari ja escombra les quatre escenes amb les
          // stills mentre el film es descarrega en segon pla.
          const isMobile = window.matchMedia('(max-width: 860px)').matches
          const source = isMobile ? heroFilm.srcMobile : heroFilm.src

          stage.dataset.heroState = 'loading'
          section.setAttribute('aria-busy', 'true')
          if (progressLabel) progressLabel.textContent = percent.format(0)

          // Ganxo mínim de test: permet escurçar el timeout de 20s des de
          // Playwright (`page.addInitScript`) sense tocar el codi de
          // producció. Mai es defineix fora d'un context de test.
          const loadTimeoutMs = readTestHook('HERO_LOAD_TIMEOUT_MS') ?? DEFAULT_LOAD_TIMEOUT_MS

          // Mateix ganxo, per al temporitzador de seguretat del LCP.
          const lcpSafetyTimeoutMs = readTestHook('HERO_LCP_TIMEOUT_MS') ?? DEFAULT_LCP_SAFETY_TIMEOUT_MS

          // Mateix ganxo, per al temporitzador del `seek` (I2, vegeu més avall).
          const seekTimeoutMs = readTestHook('HERO_SEEK_TIMEOUT_MS') ?? DEFAULT_SEEK_TIMEOUT_MS

          // `cancelled` és el flag terminal: un cop `toStills()` l'ha
          // marcat (error, timeout o avortament), cap resposta tardana de
          // la xarxa o del vídeo pot tornar a moure l'estat — ni
          // `onReady`, ni `seekToProgress`, ni la promesa del `fetch`.
          let cancelled = false
          // I2 regression: `loadedmetadata` → `seekToProgress` → `seeked` →
          // `onReady` sol acabar (xarxa local, cerca curta) abans que
          // arribi `loadeddata` — l'ordre entre `seeked` i `loadeddata` no
          // el garanteix cap especificació. Quan passa, `onReady` ja ha
          // netejat `seekTimeout` (encara `undefined`, `clearTimeout` no fa
          // res) i deixa l'escenari en `playing`; `loadeddata` arriba tot
          // seguit i, sense aquest flag, en tornava a armar un de nou que
          // ningú cancel·lava — cinc segons després `toStills()` apagava el
          // film ja en marxa. `ready` és qui talla aquell segon armament.
          let ready = false
          let objectUrl = ''
          let loadTimeout: number | undefined
          let seekTimeout: number | undefined
          const controller = new AbortController()

          const revokeObjectUrl = () => {
            if (!objectUrl) return
            URL.revokeObjectURL(objectUrl)
            objectUrl = ''
          }

          // Només el que es veu: fotos i carril sense indicador. No cancel·la
          // res — és el que fa el vigilant de la baixada quan expira, mentre
          // el `fetch` segueix el seu curs (vegeu `DEFAULT_LOAD_TIMEOUT_MS`).
          const showStills = () => {
            stage.dataset.heroState = 'stills'
            section.setAttribute('aria-busy', 'false')
          }

          const toStills = () => {
            if (cancelled) return
            cancelled = true
            controller.abort()
            window.clearTimeout(loadTimeout)
            window.clearTimeout(seekTimeout)
            revokeObjectUrl()
            showStills()
          }

          // Vigilant de la baixada: en expirar, l'escenari deixa d'anunciar
          // càrrega però no renuncia al film. `ready` i `cancelled` ja han
          // decidit l'estat si arriben abans.
          const onLoadTimeout = () => {
            if (cancelled || ready) return
            showStills()
          }

          // Erro de descodificació o de xarxa un cop el vídeo ja té `src`:
          // el mateix desenllaç que el `.catch` del `fetch` — l'escenari es
          // queda amb les stills, mai torna a quatre seccions.
          const handleError = () => toStills()
          video.addEventListener('error', handleError)

          // Safari, en segon pla, deixa de presentar fotogrames nous d'un
          // <video> aturat: `currentTime` continua avançant amb l'scroll
          // (l'`onUpdate` de la timeline el segueix escrivint) però la
          // pantalla es queda congelada al fotograma d'abans d'amagar la
          // pestanya — és un comportament conegut de WebKit, no un error del
          // nostre estat, i per això no es pot reproduir en automatització
          // (cap navegador headless suspèn la decodificació en segon pla).
          // El remei estàndard és forçar un cicle `play()`/`pause()` en
          // tornar visible perquè el descodificador presenti el fotograma
          // actual: el vídeo ja és `muted` i `playsInline`, així que la
          // política d'autoplay ho permet sense cap gest de l'usuari, i
          // `pause()` arriba de seguida perquè el film mai s'ha de veure
          // reproduint-se sol — només ha d'avançar amb l'scroll. Si `play()`
          // es rebutja igualment (Safaris vells, pressió de memòria), es
          // recorre a moure `currentTime` un instant i tornar-lo al lloc:
          // qualsevol dels dos camins obliga el descodificador a repintar.
          // Sense feina si l'escenari no és `playing` (carregant, stills o
          // ja cancel·lat): no s'ha de reobrir cap finestra dels watchdogs
          // d'aquí dalt ni tocar un vídeo que encara no s'ha de veure.
          const resumePresentation = safe(() => {
            if (document.visibilityState !== 'visible') return
            if (cancelled) return
            // El film és a punt però no s'ha pogut revelar (política de
            // reproducció, pestanya amagada en aquell moment): en tornar a
            // primer pla es torna a provar.
            if (ready && stage.dataset.heroState !== 'playing') {
              tryReveal()
              return
            }
            if (stage.dataset.heroState !== 'playing') return

            const played = video.play()
            if (played && typeof played.then === 'function') {
              played
                .then(() => video.pause())
                .catch(() => {
                  if (cancelled) return
                  const current = video.currentTime
                  const nudge = current > 0.05 ? current - 0.05 : current + 0.05
                  video.currentTime = nudge
                  requestAnimationFrame(() => {
                    if (!cancelled) video.currentTime = current
                  })
                })
            } else {
              video.pause()
            }
          })
          document.addEventListener('visibilitychange', resumePresentation)
          // `pageshow` cobreix el retorn des del bfcache (navegació enrere a
          // Safari): la pestanya pot tornar visible sense que es disparés
          // `visibilitychange` si la pàgina sencera es restaura de cop.
          window.addEventListener('pageshow', resumePresentation)

          // Un cop el vídeo té metadades (durada, `seekable`), es porta el
          // cap de lectura fins on l'espectador ja hagi arribat fent
          // scroll durant la descàrrega, abans de deixar-lo visible: si no,
          // el primer fotograma en aparèixer no coincidiria amb l'escena.
          const onReady = safe(() => {
            if (cancelled) return
            ready = true
            window.clearTimeout(loadTimeout)
            window.clearTimeout(seekTimeout)

            if (isMobile) {
              const lastSegment = beatSegments(count)[count - 1]
              timeline.fromTo(
                video,
                { objectPosition: '50% 45%' },
                { duration: lastSegment.end - lastSegment.start, objectPosition: '80% 45%' },
                lastSegment.start,
              )
            }

            // Columna vertebral: la timeline dura 1 i arrossega el cap de
            // lectura del vídeo, de 0 a `video.duration`, sobre tot el seu
            // rang — `playhead` comença fresc a 0 perquè aquesta
            // interpolació sigui correcta es rendritzi quan es rendritzi
            // (el primer render no té per què coincidir amb l'scroll
            // actual): sembrar-lo amb el progrés ja fet giraria malament la
            // interpolació. La imatge ja s'ha post al fotograma correcte
            // (vegeu `seekToProgress`) abans de fer-lo visible, així que cap
            // de les dues coses xoca. Mai s'encua una cerca mentre el
            // descodificador en resol una altra; si es fes, un gest ràpid
            // el deixaria congelat.
            const playhead = { time: 0 }
            timeline.to(
              playhead,
              {
                duration: 1,
                onUpdate: () => {
                  if (!video.seeking) video.currentTime = playhead.time
                },
                time: video.duration,
              },
              0,
            )

            // Tant si s'arriba des de `loading` com des de `stills` (el
            // vigilant havia expirat però la baixada ha acabat igualment):
            // el film ja és al fotograma correcte. Però no es revela fins
            // que el descodificador ha acceptat reproduir-lo un instant
            // (vegeu `prime` i `tryReveal`): WebKit no pinta mai el
            // fotograma d'un vídeo silenciós que només s'ha cercat i al
            // qual no deixa reproduir-se, i el que es veuria seria el
            // `poster` (l'escena 1) fix a sobre de tot mentre l'scroll
            // avança. Passa amb el mode de baix consum del Mac i de l'iPad
            // (`RequireUserGestureForVideoDueToLowPowerMode`: `play()` es
            // rebutja amb NotAllowedError i tots els fotogrames descodificats
            // es descarten — mesurat el 2026-09-25 amb
            // `getVideoPlaybackQuality`, 136/136 descartats) i amb la
            // política de reproducció automàtica quan és restrictiva.
            tryReveal()
          })

          // Cicle `play()`/`pause()`: el film és `muted` i `playsInline`,
          // així que on la política ho permet es resol sense cap gest i el
          // vídeo queda aturat al mateix fotograma; on no, rebutja. Sense
          // promesa (navegadors vells) es dona per resolt.
          const prime = (): Promise<void> => {
            const played = video.play()
            if (played && typeof played.then === 'function') {
              return played.then(() => video.pause())
            }
            video.pause()
            return Promise.resolve()
          }

          // Revelar només si el descodificador ha acceptat reproduir: si no,
          // l'escenari es queda amb les stills (que sí que segueixen
          // l'scroll) en lloc d'un pòster congelat, i es torna a provar al
          // primer gest de l'usuari (el que desbloqueja WebKit: punter o
          // teclat; l'scroll de trackpad no compta com a gest) o en tornar
          // la pestanya a primer pla. `revealed` és terminal: un cop el film
          // es veu, cap reintent el toca.
          let revealed = false
          let revealing = false
          const gestureEvents = ['pointerdown', 'keydown', 'touchend'] as const
          const tryReveal = safe(() => {
            if (cancelled || revealed || revealing) return
            if (document.visibilityState !== 'visible') {
              showStills()
              return
            }
            revealing = true
            prime()
              .then(() => {
                revealing = false
                if (cancelled || revealed) return
                revealed = true
                gestureEvents.forEach((name) => window.removeEventListener(name, tryReveal))
                stage.dataset.heroState = 'playing'
                section.setAttribute('aria-busy', 'false')
              })
              .catch(() => {
                revealing = false
                if (cancelled || revealed) return
                showStills()
              })
          })
          gestureEvents.forEach((name) => window.addEventListener(name, tryReveal, { passive: true }))

          const seekToProgress = () => {
            if (cancelled) return
            const trigger = timeline.scrollTrigger
            const target = (trigger ? trigger.progress : 0) * video.duration
            if (Math.abs(video.currentTime - target) < 0.01) {
              onReady()
              return
            }
            video.addEventListener('seeked', onReady, { once: true })
            video.currentTime = target
          }
          video.addEventListener('loadedmetadata', seekToProgress, { once: true })
          // I2: la descàrrega ha arribat, però encara falta el `seek` fins al
          // punt d'scroll actual — l'única cosa que porta l'estat a
          // `playing` (`seekToProgress` → `onReady`, més amunt). El
          // temporitzador de 20s d'aquí dalt ja no vigila res un cop
          // arribats aquí, així que se n'arma un de nou, més curt, apuntant
          // al mateix desenllaç (`toStills`): si `seeked` no arriba mai
          // (`duration` NaN/Infinity, descodificador que abandona la cerca
          // sota pressió de memòria), l'escenari no es queda penjat a
          // `loading` per sempre. Però si `onReady` ja ha corregut (`ready`),
          // aquesta finestra ja s'ha tancat amb èxit: armar-ne un altre
          // apagaria un film que ja s'estigués reproduint. `cancelled` es
          // comprova pel mateix motiu (un error de vídeo ja ha decidit
          // l'estat abans que arribi aquest event).
          video.addEventListener(
            'loadeddata',
            () => {
              window.clearTimeout(loadTimeout)
              if (cancelled || ready) return
              seekTimeout = window.setTimeout(toStills, seekTimeoutMs)
            },
            { once: true },
          )

          // Blob: molts servidors no responen peticions de rang, i sense
          // rang `video.seekable` es queda a zero i el film no es mou mai
          // del frame 0. Es llegeix el cos com a stream perquè el carril
          // pugui dibuixar-ne el progrés determinat (filet i percentatge);
          // si el `fetch` no dona `body` (un `Response` no transmissible),
          // es cau a `blob()` tal com feia el codi antic — l'etiqueta es
          // queda a 0 % fins que el film es revela.
          const load = () => {
            loadTimeout = window.setTimeout(onLoadTimeout, loadTimeoutMs)

            fetch(source, { signal: controller.signal })
              .then((response) => {
                if (!response.ok) return Promise.reject(new Error('film'))
                if (!response.body) return response.blob()

                const total = Number(response.headers.get('Content-Length')) || 0
                const reader = response.body.getReader()
                const chunks: BlobPart[] = []
                let received = 0

                const pump = (): Promise<BlobPart[]> =>
                  reader.read().then(({ done, value }) => {
                    if (done) return chunks
                    chunks.push(value)
                    received += value.byteLength
                    if (total > 0) {
                      const fraction = received / total
                      if (progressBar) progressBar.style.transform = `scaleX(${fraction})`
                      if (progressLabel) progressLabel.textContent = percent.format(fraction)
                    }
                    return pump()
                  })

                return pump().then((parts) => new Blob(parts))
              })
              .then((blob) => {
                if (cancelled) return
                objectUrl = URL.createObjectURL(blob)
                // El marcatge diu `preload="none"` perquè res es baixi
                // abans d'hora; Safari el respecta fins i tot amb un Blob i
                // no arriba mai a `loadedmetadata`. El film ja és a
                // memòria: es demana.
                video.preload = 'auto'
                video.src = objectUrl
                video.load()
              })
              .catch(toStills)
          }

          // El poster del beat 1 és el candidat a LCP: la baixada del film
          // no ha de competir per l'ample de banda inicial. S'ajorna fins
          // després de `load` i, un cop allà, fins a un moment ociós del
          // fil principal. Safari no té `requestIdleCallback`; el retard
          // fix és l'equivalent.
          const idleSupported = typeof window.requestIdleCallback === 'function'
          const idle: (callback: IdleRequestCallback) => number = idleSupported
            ? window.requestIdleCallback.bind(window)
            : (callback) =>
                window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 400)
          const cancelIdle: (handle: number) => void = idleSupported
            ? window.cancelIdleCallback.bind(window)
            : window.clearTimeout.bind(window)

          let idleHandle: number | undefined
          let cancelLcpWait: (() => void) | undefined
          const scheduleLoad = () => {
            idleHandle = idle(() => {
              // Últim graó abans del `fetch`: el poster ja hi és des del
              // primer frame, així que només cal esperar que el navegador
              // n'hagi enregistrat el LCP (o el temporitzador de seguretat)
              // perquè el film no li pugui prendre el lloc.
              cancelLcpWait = waitForLargestContentfulPaint(lcpSafetyTimeoutMs, () => void load())
            })
          }

          const alreadyLoaded = document.readyState === 'complete'
          if (alreadyLoaded) {
            scheduleLoad()
          } else {
            window.addEventListener('load', scheduleLoad, { once: true })
          }

          return () => {
            // `toStills()` ja és terminal i idempotent: marca `cancelled`,
            // avorta el `fetch` en curs i revoca l'`objectUrl` si n'hi
            // havia — el mateix camí que un error o un timeout.
            toStills()
            teardown()
            if (!alreadyLoaded) window.removeEventListener('load', scheduleLoad)
            if (idleHandle !== undefined) cancelIdle(idleHandle)
            cancelLcpWait?.()
            video.removeEventListener('loadedmetadata', seekToProgress)
            video.removeEventListener('seeked', onReady)
            video.removeEventListener('error', handleError)
            document.removeEventListener('visibilitychange', resumePresentation)
            window.removeEventListener('pageshow', resumePresentation)
            gestureEvents.forEach((name) => window.removeEventListener(name, tryReveal))
          }
        },
      )

      return () => mm.revert()
    },
    { dependencies: [count, heroFilm.src, heroFilm.srcMobile], scope: root },
  )

  return (
    <div className="contents" ref={root}>
      {children}
    </div>
  )
}
