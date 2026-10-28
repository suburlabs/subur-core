import { redirect } from 'next/navigation'

import type { SiteData } from '../../app/siteData.js'
import type { Locale } from '../../i18n/config.js'
import { pageHref } from '../../i18n/paths.js'

type Props = {
  data: SiteData
  locale: Locale
  slug: string
}

/**
 * Cerca l'`slug` a la col·lecció de redireccions i, si hi ha coincidència,
 * torna la URL de destí; si no n'hi ha, `null`. Pura: no llança res ni
 * renderitza, perquè tant `[slug]/page.tsx` (al cos de la pàgina i a
 * `generateMetadata`) com el component `Redirects` de sota puguin decidir
 * `redirect()`/`notFound()` pel seu compte, sense duplicar la consulta.
 */
export async function resolveRedirectTarget(data: SiteData, locale: Locale, slug: string): Promise<null | string> {
  const redirects = await data.getCachedRedirects()()
  const candidates = [pageHref(locale, slug), `/${slug}`]
  const match = redirects.find((item) => candidates.includes(item.from))

  if (match?.to?.url) return match.to.url

  const reference = match?.to?.reference
  if (reference && typeof reference.value === 'object' && reference.value.slug) {
    return pageHref(locale, reference.value.slug)
  }

  return null
}

/**
 * Ús restant: quan `[slug]/page.tsx` ja ha trobat una pàgina real i vol
 * deixar que una redirecció explícita hi tingui prioritat igualment. Mai
 * crida `notFound()` — la pàgina existeix; el cas de la pàgina inexistent ja
 * no passa per aquí: `[slug]/page.tsx` el resol al seu propi cos, abans de
 * retornar cap JSX (vegeu el comentari de `Page` a `page.tsx` sobre l'abast
 * real d'aquest reordenament i el límit de Next.js que hi queda per sota).
 */
export async function Redirects({ data, locale, slug }: Props): Promise<null> {
  const target = await resolveRedirectTarget(data, locale, slug)
  if (target) redirect(target)

  return null
}
