export const pageHref = (locale: string, slug: string): string =>
  slug === 'home' ? `/${locale}` : `/${locale}/${slug}`

export function switchLocalePath(
  href: string,
  nextLocale: string,
  knownLocales: readonly string[],
): string {
  const url = new URL(href, 'http://localhost')
  const segments = url.pathname.split('/').filter(Boolean)

  if (segments[0] && knownLocales.includes(segments[0])) {
    segments[0] = nextLocale
  } else {
    segments.unshift(nextLocale)
  }

  return `/${segments.join('/')}${url.search}${url.hash}`
}
