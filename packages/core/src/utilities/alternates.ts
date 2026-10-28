import { supportedLocales } from '../i18n/catalog.js'
import { type Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'

export function buildAlternates(
  locale: Locale,
  slug: string,
  activeLocales: readonly Locale[],
  defaultLocale: Locale,
) {
  const languages: Record<string, string> = {}

  for (const code of activeLocales) {
    languages[supportedLocales[code].hreflang] = pageHref(code, slug)
  }
  languages['x-default'] = pageHref(defaultLocale, slug)

  return { canonical: pageHref(locale, slug), languages }
}
