import { type NextRequest, NextResponse } from 'next/server'
import { siteConfig } from 'subur-site-config'

import { LOCALE_COOKIE } from '../i18n/config.js'
import { getLocaleRedirect } from '../i18n/localeRedirect.js'
import { defaultLocaleOf } from '../site/index.js'

/** El `matcher` és literal al fitxer de ruta del client: Next l'analitza estàticament (spec §4.2). */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const target = getLocaleRedirect({
    acceptLanguage: request.headers.get('accept-language'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    defaultLocale: defaultLocaleOf(siteConfig),
    pathname,
    search,
  })
  return target ? NextResponse.redirect(new URL(target, request.url), 307) : NextResponse.next()
}
