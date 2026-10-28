import type { SupportedLocale } from '../i18n/catalog.js'

export type SiteConfig = {
  /**
   * Identificador curt del client (spec §23.3): nom de la base i del rol a la
   * plataforma, directori del client al servidor, prefix dels buckets i
   * del paquet de traspàs. Minúscules, xifres i `_`, com exigeix
   * `deploy/platform/create-client-db.sh`.
   */
  id: string
  /**
   * Domini públic de la web, sense `https://` (spec §24.3): el que `pnpm ops`
   * fa servir per al DNS, Caddy, Umami i la comprovació de salut. Si n'hi ha
   * més d'un (`www`), aquest és el principal.
   */
  domain: string
  /**
   * Idioma del client per als documents que rep (informe SEO, paquet de
   * traspàs): `es` o `ca` avui. És l'idioma del negoci, no el de la web.
   */
  clientLocale: SupportedLocale
  assets: {
    favicon: string
    /**
     * El film del hero: una presa contínua de cinc legs encadenats (quatre beats).
     * `posters` són frames del mateix film, un per beat, i són el que es
     * veu quan no hi ha moviment, JavaScript o crèdits de xarxa.
     */
    heroFilm: {
      duration: number
      posters: readonly { height: number; src: string; width: number }[]
      src: string
      srcMobile: string
    }
    logo: string
    logoMark: string
    logoSize: { height: number; width: number }
  }
  defaultLocale: SupportedLocale
  legalSlugs: {
    cookies: string
    legalNotice: string
    privacy: string
  }
  name: string
  optionalBlocks: {
    scrollHero: boolean
    taskCatalog: boolean
  }
  /** Dades estructurades (spec §20.3): el subtipus de negoci local de schema.org. */
  seo: {
    schemaType: 'LocalBusiness' | 'HomeAndConstructionBusiness' | 'ProfessionalService'
  }
  /**
   * El `<meta name="theme-color">` del layout; ha de coincidir amb `--background`
   * de `theme.css`. Cada color en `#rrggbb`, com exigeix `parseFacts`.
   */
  themeColor: { light: string; dark: string }
}
