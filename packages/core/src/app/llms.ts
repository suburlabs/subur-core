import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import { siteConfig } from 'subur-site-config'

import type { Locale } from '../i18n/config.js'
import { defaultLocaleOf } from '../site/index.js'
import { MODULE_AI_VISIBILITY } from '../subur/modules.js'
import { CACHE_REVALIDATE_SECONDS } from '../utilities/cacheRevalidate.js'
import { getServerSideURL } from '../utilities/getURL.js'
import { buildLlmsTxt, type LlmsPage } from '../utilities/llmsTxt.js'
import { type ConfigArg, createSiteData } from './siteData.js'

/** `/llms.txt` (spec §22.4): només amb el mòdul `ai-visibility`; sense, un 404 de text. */
export function createLlmsRoute({ config }: { config: ConfigArg }) {
  const data = createSiteData(config)
  const defaultLocale = defaultLocaleOf(siteConfig)

  const getLlmsTxt = unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      const activeLocales = await data.getActiveLocales()

      const byLocale = await Promise.all(
        activeLocales.map(async (locale) => {
          const { docs } = await payload.find({
            collection: 'pages',
            depth: 0,
            draft: false,
            fallbackLocale: false,
            limit: 1000,
            locale,
            overrideAccess: false,
            pagination: false,
            select: { meta: { description: true }, slug: true, title: true },
            where: { _status: { equals: 'published' } },
          })
          return { docs, locale }
        }),
      )

      const pages = new Map<string, LlmsPage>()
      for (const { docs, locale } of byLocale) {
        for (const doc of docs) {
          if (!doc.slug) continue
          const page = pages.get(doc.slug) ?? { byLocale: {}, slug: doc.slug }
          if (doc.title) page.byLocale[locale as Locale] = { description: doc.meta?.description, title: doc.title }
          pages.set(doc.slug, page)
        }
      }

      const settings = await payload.findGlobal({ depth: 0, locale: defaultLocale, slug: 'site-settings' })
      return buildLlmsTxt({
        activeLocales,
        defaultLocale,
        facts: {
          areaServed: (settings.location?.areaServed ?? []).map((a) => a.name).filter(Boolean),
          email: settings.email,
          locality: settings.location?.addressLocality,
          phone: settings.phone,
        },
        legalSlugs: Object.values(siteConfig.legalSlugs),
        pages: [...pages.values()],
        siteName: siteConfig.name,
        siteUrl: getServerSideURL(),
      })
    },
    ['llms-txt'],
    // Termini a més de les etiquetes: vegeu `cacheRevalidate.ts`.
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['llms-txt', 'global_subscription', 'global_site-settings'] },
  )

  return {
    async GET() {
      if (!(await data.hasModule(MODULE_AI_VISIBILITY))) {
        return new Response('Not found\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' }, status: 404 })
      }
      return new Response(await getLlmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    },
  }
}
