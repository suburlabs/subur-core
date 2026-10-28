import { unstable_cache } from 'next/cache'
import { draftMode } from 'next/headers'
import { type DataFromGlobalSlug, getPayload, type SanitizedConfig } from 'payload'
import { cache } from 'react'
import { siteConfig } from 'subur-site-config'

import { sortActiveLocales } from '../i18n/activeLocalesOrder.js'
import type { Locale } from '../i18n/config.js'
import { defaultLocaleOf } from '../site/index.js'
import type { Page, Redirect } from '../types/subur-types.js'
import { CACHE_REVALIDATE_SECONDS } from '../utilities/cacheRevalidate.js'
import { type ResolvedSiteSettings, resolveSiteSettings } from '../utilities/siteSettings.js'

/** El que accepten totes les API del motor que les fàbriques fan servir (RootLayout, RootPage, NotFoundPage, generatePageMetadata, GRAPHQL_PLAYGROUND_GET; D7; sonda S6); `buildSuburConfig` i `@payload-config` ja en donen una. */
export type ConfigArg = Promise<SanitizedConfig>

type CachedGlobal = 'footer' | 'header' | 'site-settings'

export type SiteData = {
  getActiveLocales(): Promise<Locale[]>
  getCachedGlobal<T extends CachedGlobal>(slug: T, locale: Locale, depth?: number): () => Promise<DataFromGlobalSlug<T>>
  getCachedRedirects(): () => Promise<Redirect[]>
  getFooterCredit(): Promise<boolean>
  getModules(): Promise<string[]>
  getPage(slug: string, locale: Locale): Promise<Page | null>
  getSiteSettings(locale: Locale): Promise<ResolvedSiteSettings>
  hasModule(id: string): Promise<boolean>
}

/**
 * Les lectures del graf de render (spec §3.2.1): la configuració del CMS arriba per argument i l'idioma per defecte, de
 * `subur-site-config`. Les claus d'`unstable_cache`, les etiquetes i el termini són els d'abans de l'extracció: el
 * *handler* de la cau i la porta en depenen. L'etiqueta dona el camí immediat; el termini evita que una entrada desada
 * sobrevisqui una invalidació perduda (vegeu `cacheRevalidate.ts`).
 */
export function createSiteData(config: ConfigArg): SiteData {
  const defaultLocale = defaultLocaleOf(siteConfig)
  const payload = () => getPayload({ config })

  const getCachedGlobal = <T extends CachedGlobal>(slug: T, locale: Locale, depth = 0) =>
    unstable_cache(
      async (): Promise<DataFromGlobalSlug<T>> => (await payload()).findGlobal({ depth, fallbackLocale: defaultLocale, locale, slug }),
      [slug, locale, String(depth)],
      { revalidate: CACHE_REVALIDATE_SECONDS, tags: [`global_${slug}`] },
    )

  /**
   * Els idiomes contractats d'aquesta web. Es llegeix del global en memòria cau, mai de la petició: les pàgines
   * públiques són estàtiques sota demanda. El hook únic d'invalidació (`'*'`) la caduca a l'instant en desar
   * `subscription`.
   */
  const getActiveLocales = unstable_cache(
    async (): Promise<Locale[]> => {
      const subscription = await (await payload()).findGlobal({ depth: 0, slug: 'subscription' })
      return sortActiveLocales(subscription.activeLocales ?? [], defaultLocale)
    },
    ['active-locales'],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['global_subscription'] },
  )

  /** Els mòduls contractats (spec §25.5): ids del catàleg de Subur, escrits al global per `pnpm ops deploy`. */
  const getModules = unstable_cache(
    async (): Promise<string[]> => {
      const subscription = await (await payload()).findGlobal({ depth: 0, slug: 'subscription' })
      return Array.isArray(subscription.modules) ? subscription.modules.filter((id): id is string => typeof id === 'string') : []
    },
    ['subscription-modules'],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['global_subscription'] },
  )

  /** Si el peu pinta el crèdit de Subur (spec §0.5): el camp del global, que escriu el seed (i, a partir d'E3b, `pnpm ops deploy`). */
  const getFooterCredit = unstable_cache(
    async (): Promise<boolean> => {
      const subscription = await (await payload()).findGlobal({ depth: 0, slug: 'subscription' })
      return subscription.footerCredit === true
    },
    ['subscription-footer-credit'],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['global_subscription'] },
  )

  /** `ui` es llegeix SENSE *fallback* d'idioma (vegeu `resolveSiteSettings`). */
  const getUiOverrides = (locale: Locale) =>
    unstable_cache(
      async () => {
        const settings = await (await payload()).findGlobal({ depth: 0, fallbackLocale: false, locale, select: { ui: true }, slug: 'site-settings' })
        return settings.ui ?? {}
      },
      ['site-settings-ui', locale],
      { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['global_site-settings'] },
    )

  /** Totes les redireccions juntes, en una sola entrada de cau (una sola consulta per a totes les rutes). */
  const getCachedRedirects = () =>
    unstable_cache(
      async (): Promise<Redirect[]> => {
        const { docs } = await (await payload()).find({ collection: 'redirects', depth: 1, limit: 0, pagination: false })
        return docs
      },
      ['redirects'],
      { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['redirects'] },
    )

  /** Una consulta per render (`cache` de React): `generateMetadata` i la pàgina la comparteixen. */
  const getPage = cache(async (slug: string, locale: Locale): Promise<Page | null> => {
    const { isEnabled: draft } = await draftMode()
    const result = await (await payload()).find({
      collection: 'pages',
      depth: 2,
      draft,
      fallbackLocale: defaultLocale,
      limit: 1,
      locale,
      overrideAccess: draft,
      pagination: false,
      where: { slug: { equals: slug } },
    })
    return result.docs[0] ?? null
  })

  return {
    getActiveLocales,
    getCachedGlobal,
    getCachedRedirects,
    getFooterCredit,
    getModules,
    getPage,
    async getSiteSettings(locale) {
      const [settings, overrides] = await Promise.all([getCachedGlobal('site-settings', locale, 0)(), getUiOverrides(locale)()])
      return resolveSiteSettings(settings, overrides, locale)
    },
    /** Una funcionalitat s'activa pel mòdul, no pel pla (spec §25.5, decisió 3 de subur-business). */
    hasModule: async (id) => (await getModules()).includes(id),
  }
}
