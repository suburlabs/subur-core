import type { Metadata } from 'next'

import { supportedLocales } from '../i18n/catalog.js'
import type { Locale } from '../i18n/config.js'
import { siteConfig } from 'subur-site-config'
import { defaultLocaleOf } from '../site/index.js'
import type { Page } from '../types/subur-types.js'

import { buildAlternates } from './alternates.js'
import { mergeOpenGraph } from './mergeOpenGraph.js'

type Args = {
  activeLocales: readonly Locale[]
  doc: Partial<Page> | null
  locale: Locale
  slug: string
}

export function generateMeta({ activeLocales, doc, locale, slug }: Args): Metadata {
  const title =
    doc?.meta?.title || (doc?.title ? `${doc.title} | ${siteConfig.name}` : siteConfig.name)
  const description = doc?.meta?.description ?? undefined
  const image = doc?.meta?.image
  const imageUrl =
    image && typeof image === 'object' ? (image.sizes?.og?.url ?? image.url ?? undefined) : undefined
  const alternates = buildAlternates(locale, slug, activeLocales, defaultLocaleOf(siteConfig))

  return {
    alternates,
    description,
    openGraph: mergeOpenGraph({
      description,
      locale: supportedLocales[locale].og,
      siteName: siteConfig.name,
      title,
      url: alternates.canonical,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    }),
    title,
  }
}
