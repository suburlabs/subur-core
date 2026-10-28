import type { Locale } from '../../i18n/config.js'
import { pageHref } from '../../i18n/paths.js'
import type { Page } from '../../types/subur-types.js'

export type LinkData = {
  label?: string | null
  newTab?: boolean | null
  reference?: { relationTo: 'pages'; value: number | Page } | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export function resolveLinkHref(link: LinkData, locale: Locale): string | null {
  if (link.type === 'reference') {
    const value = link.reference?.value
    return typeof value === 'object' && value?.slug ? pageHref(locale, value.slug) : null
  }

  return link.url || null
}
