import type { ISitemapField } from 'next-sitemap'

import { supportedLocales } from '../i18n/catalog.js'
import { type Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'

export type SitemapPage = {
  slug?: null | string
  updatedAt?: null | string
}

export type PagesSitemapInput = {
  activeLocales: readonly Locale[]
  defaultLocale: Locale
  pages: readonly SitemapPage[]
  siteUrl: string
}

/**
 * Les entrades del mapa del lloc de les pàgines: una per idioma actiu i per
 * pàgina, totes amb la mateixa llista d'alternatives més `x-default`.
 *
 * Els idiomes que la subscripció no té actius no hi surten ni com a URL ni
 * com a alternativa: la web els redirigeix a l'idioma per defecte i anunciar-los
 * seria enviar els cercadors a una redirecció. `x-default` apunta sempre a
 * l'idioma per defecte, que és actiu sempre (ho garanteix `validateActiveLocales`).
 *
 * És pura a posta: la ruta hi posa les dades i la memòria cau, i això es pot
 * provar amb qualsevol subconjunt d'idiomes sense muntar cap subscripció.
 */
export function buildPagesSitemap({
  activeLocales,
  defaultLocale,
  pages,
  siteUrl,
}: PagesSitemapInput): ISitemapField[] {
  return pages
    .filter((page): page is SitemapPage & { slug: string } => Boolean(page.slug))
    .flatMap((page) => {
      const alternateRefs = [
        ...activeLocales.map((locale) => ({
          href: `${siteUrl}${pageHref(locale, page.slug)}`,
          hreflang: supportedLocales[locale].hreflang,
          hrefIsAbsolute: true,
        })),
        {
          href: `${siteUrl}${pageHref(defaultLocale, page.slug)}`,
          hreflang: 'x-default',
          hrefIsAbsolute: true,
        },
      ]

      return activeLocales.map((locale) => ({
        alternateRefs,
        lastmod: page.updatedAt ?? undefined,
        loc: `${siteUrl}${pageHref(locale, page.slug)}`,
      }))
    })
}
