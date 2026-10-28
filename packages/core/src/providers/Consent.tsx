'use client'

import {
  ConsentBanner,
  ConsentDialog,
  ConsentManagerProvider,
  useConsentManager,
  type ColorTokens,
  type Theme,
} from '@c15t/nextjs'
import { useEffect, type ReactNode } from 'react'

import { umamiScripts } from '../analytics/umami.js'
import { consentMessages } from '../consent/messages.js'
import type { Locale } from '../i18n/config.js'

// Aspecte: el bàner i el diàleg han de llegir-se com un rètol de rajola
// (`Plaque`, vegeu `src/site/ui/Plaque.tsx` i DESIGN.md). Escala de
// personalització de c15t (node_modules/@c15t/nextjs/docs/frameworks/next/styling/overview.md):
// aquí ens quedem al graó 2 (`theme` tokens) i, només on calia, al graó 3
// (`theme.slots`, node_modules/@c15t/nextjs/docs/frameworks/next/styling/slots.md).
// Cap valor és literal: tots referencien els tokens de `src/site/theme.css`.
//
// Els controls d'una rajola prenen els tokens `--tile-*`, no `--primary`
// (DESIGN.md, secció Colors → Primary): `--primary` s'aclareix en mode fosc
// (el `--primary` del tema fosc) mentre la rajola es manté clara de nit, així que
// un control que llegís `--primary` hi perdria contrast. Per això
// `theme.colors.primary` apunta a `--tile-foreground` (blau constant),
// no a `--primary`.
//
// c15t no fa cap `fallback` de `colors` a `dark`: si `theme.dark` es deixa
// sense definir, el mode fosc torna a `defaultDarkColors` de la pròpia
// llibreria (`node_modules/@c15t/ui/dist-types/theme/utils.d.ts`) — un
// lila que no té res a veure amb el sistema (comprovat al navegador: sense
// `dark`, el bàner de nit sortia lila). Com que la rajola es manté clara
// als dos temes («sempre clara, també de nit», `src/site/theme.css`), els
// mateixos tokens `--tile-*` ja resolen bé en fosc: reutilitzem el mateix
// objecte per a `colors` i `dark` en lloc de duplicar-lo.
const plaqueColors: ColorTokens = {
  // Botó primari (accept-consent): camp blau amb text clar — vegeu
  // node_modules/@c15t/ui/dist/styles/primitives/button.module.css,
  // `.button-primary-filled` pinta el text amb `--button-background-color`
  // (= `--c15t-surface`, aquí `--tile`), no amb `textOnPrimary`.
  primary: 'var(--tile-foreground)',
  primaryHover: 'var(--tile-muted-foreground)',
  // Superfície del rètol (targeta del bàner i del diàleg).
  surface: 'var(--tile)',
  // Peu del bàner: superfície alternativa, un to més fosc.
  surfaceHover: 'var(--tile-shade)',
  border: 'var(--tile-foreground)',
  borderHover: 'var(--tile-muted-foreground)',
  text: 'var(--tile-foreground)',
  textMuted: 'var(--tile-muted-foreground)',
  textOnPrimary: 'var(--shutter-foreground)',
  // Interruptor de la categoria «Estrictament necessàries» (diàleg de
  // preferències, `ConsentWidget.Switch`). Sense aquestes dues claus,
  // `ColorTokens` (node_modules/@c15t/ui/dist-types/theme/types.d.ts,
  // `switchTrack`/`switchTrackActive`) queda sense definir i el component
  // no genera `--c15t-switch-track(-active)`: l'interruptor cau al lila
  // per defecte de c15t (`hsl(228, 100%, 60%)`, comprovat al navegador amb
  // `getComputedStyle` sobre `[data-testid="consent-widget-switch-necessary"]`
  // — vegeu l'informe de la Tasca 4). El polze (`switchThumb`) ja resolia bé
  // sense definir-lo, així que no cal.
  switchTrackActive: 'var(--tile-foreground)',
  switchTrack: 'var(--tile-shade)',
}

const theme: Theme = {
  colors: plaqueColors,
  dark: plaqueColors,
  typography: {
    // Cos de text: la nostra font de text. Els títols es reassignen a la
    // font de titulars amb un slot (`consentBannerTitle`/`consentDialogTitle`)
    // perquè c15t només admet una única `fontFamily` per a tot el component.
    fontFamily: 'var(--font-text-stack)',
  },
  radius: {
    // Cantonada recta arreu (rètol, botons, diàleg): `--radius` del sistema.
    sm: 'var(--radius)',
    md: 'var(--radius)',
    lg: 'var(--radius)',
  },
  shadows: {
    // Món pla, sense ombres.
    sm: 'none',
    md: 'none',
    lg: 'none',
  },
  consentActions: {
    // Secundari (reject/customize): de contorn, com el `Button` outline.
    default: { mode: 'stroke', variant: 'primary' },
    // Primari (accept): camp blau amb text clar, com el `Button` default.
    accept: { mode: 'filled', variant: 'primary' },
    reject: { mode: 'stroke', variant: 'primary' },
    customize: { mode: 'stroke', variant: 'primary' },
  },
  slots: {
    // Fix round 3: a 1440×900 el bàner (cantonada inferior ESQUERRA, la
    // mateixa que el rètol del hero) tapa «Escríbanos»/«Llámenos» —
    // mesurat amb `getBoundingClientRect()` amb `document.fonts.ready`
    // assentat abans de llegir cap rect (vegeu l'informe de la Tasca 4).
    // `ConsentBannerProps`
    // (node_modules/@c15t/react/dist-types/components/consent-banner/consent-banner.d.ts)
    // no té cap prop `position`/`placement`; `direction` només ordena els
    // botons del peu, no mou el bàner. La cantonada la tria el component
    // tot sol i sense cap prop pública: `root.js`
    // (node_modules/@c15t/react/dist/components/consent-banner/atoms/root.js)
    // fa `"ltr" === direcció ? bottomLeft : bottomRight` de manera fixa.
    // Com que el lloc és sempre LTR (es/ca/en), sempre surt `bottomLeft`.
    // `.bottomLeft`/`.bottomRight`
    // (node_modules/@c15t/ui/src/styles/components/consent-banner.module.css,
    // línies 98-106) només difereixen en `left:0` vs `right:0` (el
    // `bottom:0` és idèntic als dos). No hi ha cap prop ni token per
    // triar-ne un altre, així que el graó següent és el `style` del slot
    // `consentBanner` (el mateix `themeKey` de sèrie del component,
    // `ComponentSlots.consentBanner`,
    // `@c15t/ui/dist-types/theme/types.d.ts` línia 302): reprodueix, amb
    // els mateixos valors, la variant `.bottomRight` que el propi paquet
    // ja ofereix (no és cap número inventat). L'`style` inline sempre
    // guanya a la classe CSS del mòdul, sense `!important` ni apostes
    // d'ordre de fulls d'estil.
    //
    // `left`/`right` per si sols NO bastaven: `.root` és `display:flex;
    // flex-direction:column` sense cap `align-items` propi, així que
    // l'alineació per defecte de l'eix creuat (horitzontal, en un flex de
    // columna) és `normal` → es comporta com `flex-start`, i «start» en
    // aquest eix és *inline-start*, que depèn de `dir` (el mateix atribut
    // `dir={L}` que `root.js` posa al mateix `<div>`), no de `left`/`right`.
    // Comprovat amb `getBoundingClientRect()`: només amb `right:0` la
    // capsa arrel (invisible, `width:auto`) sí tocava el marge dret
    // (right=1440 a un viewport de 1440), però `cardShell` (440px) seguia
    // ancorat a l'esquerra de la capsa arrel (`left:97.5`) perquè `dir`
    // continua sent `"ltr"`. Cal fixar també l'eix creuat amb
    // `alignItems: 'flex-end'` (la mateixa propietat CSS del mateix slot,
    // no un token ni una classe nova) perquè `cardShell` s'ancori al
    // costat dret de la capsa arrel. Amb els tres junts, mesurat: card
    // `left=976, right=1416` — el rètol del hero acaba a x=783, així que
    // queden lliures totes dues CTA.
    // Tasca 3 (Pla H2), fix de producte: la capsa arrel del bàner
    // (`data-testid="consent-banner-root"`, l'element d'aquest mateix slot)
    // NO s'encongeix a `cardShell` (440px) a partir de `sm:` com pressuposava
    // el comentari de dalt — mesurat amb `getBoundingClientRect()` a
    // 1280×720: la capsa arrel fa `width: 1280px` (tot el viewport), no
    // ~440px, encara que `getComputedStyle` confirmi `width: auto` (la regla
    // `@media (min-width:640px){.root{width:auto}}` de
    // `consent-banner.module.css` no arriba a encongir el contenidor: el seu
    // fill `cardShell` es defineix com `width: min(100%, 440px)`, i el `100%`
    // hi introdueix una dependència circular amb l'amplada `auto` del propi
    // pare que el navegador resol estirant-lo a tot l'ample). Aquesta capsa
    // és `position: fixed`, `z-index: 999999998` i (per defecte) `pointer-
    // events: auto`, així que —encara que visualment és transparent fora de
    // la targeta— TAPA els clics de qualsevol control per sota seu a la
    // resta de la pàgina.
    //
    // Detectat en fallar intermitentment `tests/e2e/contact.e2e.spec.ts`
    // («stores a valid submission»): el clic sobre la casella «política de
    // privacidad» del formulari de contacte —que cau geomètricament sota
    // aquesta capsa un cop el bàner es munta— es perdia. Confirmat amb
    // `document.elementsFromPoint(x, y)` al punt central de la casella: SENSE
    // aquest fix, l'element superior de la pila és el `div` `consent-banner-
    // root` (no la casella); AMB aquest fix, ja no hi surt (la casella passa
    // a ser el superior). En mode `hosted` (aquesta tasca) el bàner triga a
    // muntar-se fins que `/api/c15t/init` respon (una volta de xarxa real,
    // enfront del mode `offline` anterior, gairebé instantani), la qual cosa
    // allarga la finestra en què aquesta cursa pot coincidir amb una
    // interacció real — d'aquí que abans no s'observés.
    //
    // La solució NO és envestir l'amplada (`width: 'auto'` explícit aquí NO
    // corregeix l'encongiment, comprovat: `getComputedStyle` seguia retornant
    // `1280px`), sinó fer que la capsa arrel sigui transparent als clics
    // (`pointer-events: none`) i tornar a activar-los només a la targeta
    // visible (`consentBannerCard`, més avall, `pointer-events-auto`) —així
    // la resta de la pàgina mai queda tapada, i els botons del propi bàner
    // segueixen funcionant (comprovat: clicar «Rechazar» segueix tancant el
    // bàner).
    consentBanner: { style: { left: 'auto', right: '0px', alignItems: 'flex-end', pointerEvents: 'none' } },
    // Graó 3: el títol necessita la font de titulars (display), que els
    // tokens de tipografia no poden expressar per separat del cos.
    consentBannerTitle: 'font-display',
    consentDialogTitle: 'font-display',
    // La regla «l'anell pertany al seu camp» (DESIGN.md, Ring-Belongs-To-Its-Field):
    // un anell de focus ha de contrastar amb el camp on cau, no amb la
    // pàgina. El rètol de rajola fixa el seu propi `--ring`.
    //
    // El «filet interior» (`outline` amb `outline-offset` negatiu) és la
    // vora doble pròpia de `.plaque` (`src/site/ui/primitives.css`): cap
    // token de c15t l'expressa, així que cal el slot. Com que l'offset és
    // negatiu, l'`outline` cau dins de la caixa i no el retalla el
    // `overflow: hidden` de la targeta.
    // `pointer-events-auto`: reactiva els clics només a la targeta visible,
    // ja que el seu pare (`consentBanner`, més amunt) ara els desactiva.
    consentBannerCard:
      'pointer-events-auto outline outline-1 outline-tile-foreground outline-offset-[-6px] [--ring:var(--tile-foreground)]',
    // Coixí vertical més ajustat per sota de `sm:` (mateix llindar que els
    // botons): amb la fila única de botons, el marge entre el `top` de la
    // targeta i el `bottom` de «Llámenos» era de només ~2px mesurat amb
    // `getBoundingClientRect()` — massa just. Estrènyer el `padding`
    // vertical de la capçalera i el peu allibera espai sense tocar el text.
    consentBannerHeader: 'py-3 sm:py-6',
    consentBannerFooter: 'py-3 sm:py-4',
    // `consent-dialog.module.css` porta una ombra fixa (`--consent-dialog-card-shadow`,
    // no derivada de cap token `--c15t-shadow-*`); cal un slot per treure-la.
    consentDialogCard:
      'shadow-none outline outline-1 outline-tile-foreground outline-offset-[-6px] [--ring:var(--tile-foreground)]',
    // Alçada, radi i tipus de botó com els del component `Button`
    // (`src/components/ui/button.tsx`, variant `default`/`outline`). A partir
    // de `sm:` (≥640px, on `ConsentBanner` mateix deixa de forçar
    // `width:100%` als botons — `consent-banner.module.css`) es fa servir la
    // mida `default` (`h-11 px-5`); per sota, la mida `sm` del mateix
    // component (`h-10 px-4`) perquè els tres botons càpiguen en una sola
    // fila a 390px sense sortir del viewport (mesurat amb
    // `getBoundingClientRect()`, vegeu l'informe de la Tasca 4).
    buttonPrimary: 'h-10 rounded-sm px-4 font-sans text-[0.9375rem] font-semibold sm:h-11 sm:px-5',
    buttonSecondary: 'h-10 rounded-sm px-4 font-sans text-[0.9375rem] font-semibold sm:h-11 sm:px-5',
    // L'acordió del diàleg de preferències (`ConsentWidget.Accordion`, dins
    // `ConsentDialog`) no és el mateix component que `accordion.module.css`:
    // els seus colors surten de `consent-widget.module.css`
    // (node_modules/@c15t/ui/src/styles/components/consent-widget.module.css,
    // línies 53-58). `--consent-widget-accordion-icon-color` sí llegeix
    // `var(--c15t-text-muted)` (ja correcte via `textMuted` més amunt), però
    // `--consent-widget-accordion-arrow-color` i `-content-color` (i les
    // seves variants `-dark`) hi són literals fixos (`hsl(0, 0%, 63.92%)`,
    // `hsl(0, 0%, 80%)`, `hsl(0, 0%, 36.08%)`, `hsl(0, 0%, 60%)`): cap
    // `ColorTokens` els pot expressar, així que calen aquests quatre a
    // graó 3 (slot `consentWidgetAccordion`, que embolcalla tota la llista
    // — `accordion.js` li passa `themeKey: "consentWidgetAccordion"`), no
    // graó 8 (`noStyle`) ni headless. Confirmat amb `getComputedStyle` als
    // dos temes (vegeu l'informe de la Tasca 4): sense això, la fletxa i el
    // text de la categoria sortien grisos («grisos intermedis», prohibit a
    // DESIGN.md, Do's i Don'ts).
    consentWidgetAccordion:
      '[--consent-widget-accordion-arrow-color:var(--tile-muted-foreground)] [--consent-widget-accordion-arrow-color-dark:var(--tile-muted-foreground)] [--consent-widget-accordion-content-color:var(--tile-foreground)] [--consent-widget-accordion-content-color-dark:var(--tile-foreground)]',
  },
}

// Mode 'hosted': el backend és el propi de la web, `/api/c15t`
// (src/consent/backend.ts + src/app/(frontend)/api/c15t/[...path]/route.ts,
// Tasca 1 del Pla H2), no cap servei extern. `backendURL` es passa explícit
// tot i ser el valor per defecte del client (verificat a
// node_modules/.pnpm/c15t@2.2.1_*/node_modules/c15t/dist-types/client/hosted/types.d.ts,
// `C15tInternalClientOptions.backendURL`, `@default '/api/c15t'`), perquè
// quedi documentat aquí sense dependre del valor per defecte del paquet.
// Comportament (node_modules/@c15t/nextjs/docs/shared/concepts/client-modes.md,
// «Hosted Mode»): en carregar la pàgina el client crida `/init` (jurisdicció,
// traduccions); en decidir, la decisió es desa primer en local i després es
// sincronitza amb el backend; si el backend no respon, c15t cau a `offline`
// (només navegador) i torna a sincronitzar quan torni a estar disponible.
//
// La categoria `measurement` s'hi afegeix perquè la Tasca 3 hi penjarà
// l'script d'Umami (`scripts` de `ConsentManagerProvider`); fins llavors no
// carrega res, només ofereix el control al diàleg de preferències.

// Textos del bàner: `src/consent/messages.ts`, la mateixa font que fa servir el backend.

// Tasca 5, fix de producte: el diàleg de preferències de c15t no es tanca
// amb `Escape`. Arrel confirmada al paquet instal·lat: `ConsentDialogRoot`
// (node_modules/@c15t/react/dist/components/consent-dialog/atoms/root.js)
// renderitza un `<dialog open={true} ...>` de manera declarativa, sense
// cridar mai `.showModal()`, de manera que el «light dismiss» natiu del
// navegador no s'aplica; i el seu focus trap, `useFocusTrap`
// (node_modules/@c15t/react/dist-types/hooks/use-focus-trap.d.ts) →
// `setupFocusTrap` (node_modules/@c15t/ui/dist/utils/dom.js), només
// intercepta `Tab`/`Shift+Tab`, mai `Escape`.
//
// La correcció es queda al graó 1 de l'escala de personalització: l'API
// pública i documentada de l'store (no cap intern del component). `activeUI`
// i `setActiveUI` són estat i acció públics de `useConsentManager()`
// (node_modules/c15t/dist-types/store/type.d.ts, `ActiveUI`/`StoreActions`),
// i la mateixa guia de components headless recomana llegir `activeUI` per
// saber quina superfície es mostra
// (node_modules/@c15t/nextjs/docs/frameworks/next/building-headless-components.md,
// secció «What a Policy-Aware Headless Component Should Respect»).
// `setActiveUI('none')` és la mateixa transició que ja fa `saveConsents` en
// acabar (node_modules/@c15t/nextjs/docs/frameworks/next/hooks/use-consent-manager/setting-consent.md,
// pas 2: «UI closes (activeUI → 'none')») — però sense desar cap decisió:
// tancar no és acceptar.
//
// Sense tocar el DOM del paquet (cap `.showModal()`, `querySelector` ni
// classe): l'`onKeyDown` viu al `document`, actiu només mentre el diàleg
// ho està, i es neteja en tancar-se o desmuntar. El focus en tornar no cal
// gestionar-lo aquí: el mateix `setupFocusTrap` ja guarda
// `document.activeElement` d'abans d'obrir el diàleg i el torna a enfocar
// en la neteja del seu propi efecte (la mateixa que dispara qualsevol
// tancament, també el d'«Aceptar»/«Rechazar»/«Guardar»), així que el focus
// torna sol al botó («Preferencias» del bàner o «Preferencias de cookies»
// del peu) que l'hagi obert.
function EscapeClosesPreferencesDialog(): null {
  const { activeUI, setActiveUI } = useConsentManager()

  useEffect(() => {
    if (activeUI !== 'dialog') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveUI('none')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeUI, setActiveUI])

  return null
}

export function ConsentProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: 'hosted',
        backendURL: '/api/c15t',
        // El backend resol l'idioma de la resposta de `/init` a partir de la
        // capçalera `accept-language` REAL de la petició (verificat al
        // paquet instal·lat: `resolveInitPayload`,
        // node_modules/.pnpm/@c15t+backend@2.2.1_*/node_modules/@c15t/backend/dist/261.js,
        // `request.headers.get('accept-language') || 'en'`), no de la
        // `locale` de la ruta. Sense això, un navegador de proves (o d'un
        // visitant real) amb un idioma diferent del segment de ruta fa que
        // el bàner de `/es` surti en anglès (comprovat: `curl
        // /api/c15t/init` sense capçalera retorna `"language": "en"`, i el
        // bàner renderitzat mostrava «Reject»/«Preferences»/«Accept» en
        // lloc de «Rechazar»/«Preferencias»/«Aceptar»). El `fetch` del
        // client SÍ permet sobreescriure-la (`Accept-Language` no és cap
        // capçalera prohibida de la Fetch spec), així que fixem-la a la
        // `locale` de la ruta perquè el bàner parli sempre l'idioma de la
        // pàgina, mai el de les preferències del navegador. El backend
        // només pot respondre un idioma que conegui: `ca` hi és perquè
        // `src/consent/backend.ts` hi registra `consentMessages`; en mode
        // `hosted`, el client pren sempre l'idioma de la resposta.
        headers: { 'Accept-Language': locale },
        consentCategories: ['necessary', 'measurement'],
        // Tasca 3 (Pla H2): l'script d'Umami, si les dues variables hi són,
        // sota la categoria `measurement` — c15t no el carrega fins que el
        // visitant hi consenti. `next.config.ts`/`src/plugins/index.ts` ja
        // ha fet fallar l'arrencada si només n'hi ha una (mateix patró que
        // `s3Config`, `src/storage/s3.ts`); aquí, en canvi, cal llegir cada
        // variable `NEXT_PUBLIC_*` de manera literal: Next només substitueix
        // accessos literals de `process.env.NEXT_PUBLIC_*` en compilar per al
        // client, no un `process.env` sencer passat com a objecte.
        scripts: umamiScripts({
          NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
          NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
        }),
        i18n: {
          locale,
          messages: consentMessages,
        },
        theme,
      }}
    >
      {children}
      {/* Fix round 1, dos passos mesurats amb `getBoundingClientRect()` a
          390 px real (no una captura):
          1) La fila única de tres botons amb la mida `default` de `Button`
             (`px-5`) sortia 9px del viewport («Aceptar»: `right: 399` >
             `clientWidth: 390`), sense que `scrollWidth` ho delatés perquè
             `overflow: hidden` de la targeta se'l menjava.
          2) Simplement tornar a les dues files per defecte del component
             tampoc servia: la targeta (no els botons, la targeta sencera)
             passava a fer 299px d'alt i el seu `top` (528.7) queia per
             sobre del `bottom` de «Llámenos» (586.8) — 58px de tapament
             real, encara que els BOTONS mateixos no coincidissin amb els
             del hero.
          La solució: una sola fila (estalvia la segona fila sencera) amb la
          mida `sm` de `Button` (`h-10 px-4`, vegeu el slot `buttonPrimary`/
          `buttonSecondary` més amunt) només per sota de `sm:` — prou estret
          per no sortir del viewport i prou baix perquè la targeta sencera
          quedi per sota de «Llámenos». `layout` és una API del component
          (node_modules/@c15t/nextjs/docs/frameworks/next/components/consent-banner.md).
          `hideBranding` (prop del component, mateix fitxer i consent-dialog.md,
          secció «Branding»): sense l'etiqueta «Secured by c15t», tant al
          bàner com al diàleg — al diàleg queia sobre la fotografia del hero,
          que la «Shown-Not-Drawn Rule» de DESIGN.md prohibeix. */}
      <ConsentBanner hideBranding layout={[['reject', 'customize', 'accept']]} />
      <ConsentDialog hideBranding />
      <EscapeClosesPreferencesDialog />
    </ConsentManagerProvider>
  )
}
