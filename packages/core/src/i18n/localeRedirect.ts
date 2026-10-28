import { isLocale, type Locale, locales } from './config.js'
import { resolveLocale } from './resolveLocale.js'

type Input = {
  acceptLanguage?: string | null
  cookieLocale?: string | null
  pathname: string
  search?: string
  defaultLocale: Locale
}

const LOCALE_LIKE = /^[a-z]{2}(-[a-z]{2})?$/i

export function getLocaleRedirect({
  acceptLanguage,
  cookieLocale,
  pathname,
  search = '',
  defaultLocale,
}: Input): string | null {
  const segments = pathname.split('/').filter(Boolean)
  const [first, ...rest] = segments

  if (first && isLocale(first)) return null

  if (first && LOCALE_LIKE.test(first)) {
    return `/${defaultLocale}${rest.length ? `/${rest.join('/')}` : ''}${search}`
  }

  const locale = resolveLocale({ acceptLanguage, cookie: cookieLocale }, { defaultLocale, locales })

  return `/${locale}${segments.length ? `/${segments.join('/')}` : ''}${search}`
}
