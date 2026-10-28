import type { PayloadRequest } from 'payload'

import { isLocale, type Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'

type Args = {
  defaultLocale: Locale
  req: PayloadRequest
  slug: string | null | undefined
}

export const generatePreviewPath = ({ defaultLocale, req, slug }: Args): string | null => {
  if (!slug) return null

  const locale = req.locale && isLocale(req.locale) ? req.locale : defaultLocale
  const params = new URLSearchParams({
    path: pageHref(locale, encodeURIComponent(slug)),
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  return `/next/preview?${params.toString()}`
}
