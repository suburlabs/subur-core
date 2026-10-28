import { unstable_cache } from 'next/cache'
import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import { siteConfig } from 'subur-site-config'

import { defaultLocaleOf } from '../site/index.js'
import { CACHE_REVALIDATE_SECONDS } from '../utilities/cacheRevalidate.js'
import { getServerSideURL } from '../utilities/getURL.js'
import { buildPagesSitemap } from '../utilities/pagesSitemap.js'
import { type ConfigArg, createSiteData } from './siteData.js'

/** Els mapes del lloc (spec §3.1): `pages` és el de `pages-sitemap.xml`. */
export function createSitemapRoutes({ config }: { config: ConfigArg }) {
  const data = createSiteData(config)

  const getPagesSitemap = unstable_cache(
    async () => {
      const payload = await getPayload({ config })

      const { docs } = await payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: 1000,
        overrideAccess: false,
        pagination: false,
        select: { slug: true, updatedAt: true },
        where: { _status: { equals: 'published' } },
      })

      return buildPagesSitemap({
        activeLocales: await data.getActiveLocales(),
        defaultLocale: defaultLocaleOf(siteConfig),
        pages: docs,
        siteUrl: getServerSideURL(),
      })
    },
    ['pages-sitemap'],
    // Termini a més de l'etiqueta: vegeu `cacheRevalidate.ts`.
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: ['pages-sitemap'] },
  )

  return {
    pages: {
      async GET() {
        return getServerSideSitemap(await getPagesSitemap())
      },
    },
  }
}
