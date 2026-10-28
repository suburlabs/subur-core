import type { BreadcrumbList, FAQPage, Graph, Service, Thing, WebPage } from 'schema-dts'

import type { Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'
import { clean } from './clean.js'
import { MODULE_ADVANCED_SEO } from '../subur/modules.js'
import type { Page } from '../types/subur-types.js'

/**
 * Graf JSON-LD d'una pàgina (spec §22.3). Complementa el del layout
 * (`Organization`, `WebSite`, negoci local) i hi enllaça per `@id`; mai en
 * repeteix cap node. `Service` i `FAQPage` només amb el mòdul `advanced-seo`.
 */
export type PageGraphInput = {
  areaServed: readonly string[]
  homeTitle: string
  locale: Locale
  /** Els mòduls contractats (`getModules()`). */
  modules: readonly string[]
  page: Pick<Page, 'layout' | 'meta' | 'slug' | 'title'>
  siteUrl: string
}

type Block = Page['layout'][number]
type ServicesGridBlock = Extract<Block, { blockType: 'servicesGrid' }>
type FaqBlock = Extract<Block, { blockType: 'faq' }>

export function buildPageGraph(input: PageGraphInput): Graph {
  const base = input.siteUrl.replace(/\/$/, '')
  const slug = input.page.slug || 'home'
  const url = `${base}${pageHref(input.locale, slug)}`

  const breadcrumb: BreadcrumbList | undefined =
    slug === 'home'
      ? undefined
      : {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumb`,
          itemListElement: [
            {
              '@type': 'ListItem',
              item: `${base}${pageHref(input.locale, 'home')}`,
              name: input.homeTitle,
              position: 1,
            },
            { '@type': 'ListItem', item: url, name: input.page.title, position: 2 },
          ],
        }

  const webPage: WebPage = clean({
    '@type': 'WebPage' as const,
    '@id': `${url}#webpage`,
    breadcrumb: breadcrumb ? { '@id': `${url}#breadcrumb` } : undefined,
    description: input.page.meta?.description || undefined,
    inLanguage: input.locale,
    isPartOf: { '@id': `${base}/#website` },
    name: input.page.title,
    url,
  })

  const graph: Thing[] = [webPage]
  if (breadcrumb) graph.push(breadcrumb)
  if (input.modules.includes(MODULE_ADVANCED_SEO)) {
    graph.push(...services(input, base, url))
    const faq = faqPage(input, url)
    if (faq) graph.push(faq)
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

function services(input: PageGraphInput, base: string, url: string): Service[] {
  const areaServed = input.areaServed.map((name) => ({ '@type': 'City' as const, name }))
  const items = input.page.layout
    .filter((block): block is ServicesGridBlock => block.blockType === 'servicesGrid')
    .flatMap((block) => block.items ?? [])

  // Dos ítems del `servicesGrid` poden enllaçar la mateixa pàgina (p. ex. dos
  // serveis diferents presentats a la mateixa fitxa): sense aquest control,
  // tots dos generarien el mateix `<linked>#service` i el graf tindria dos
  // nodes amb idèntic `@id`, invàlid en JSON-LD. El primer conserva la forma
  // documentada (§22.3); a partir de la repetició, es desambigua amb l'índex.
  const seenIds = new Set<string>()
  return items.flatMap((item, index) => {
    if (!item.title) return []
    const linked =
      item.page && typeof item.page === 'object' && item.page.slug
        ? `${base}${pageHref(input.locale, item.page.slug)}`
        : undefined
    const preferredId = linked ? `${linked}#service` : `${url}#service-${index + 1}`
    const id = seenIds.has(preferredId) ? `${linked ?? url}#service-${index + 1}` : preferredId
    seenIds.add(id)
    return [
      clean({
        '@type': 'Service' as const,
        '@id': id,
        areaServed: areaServed.length > 0 ? areaServed : undefined,
        description: item.summary || undefined,
        name: item.title,
        provider: { '@id': `${base}/#business` },
        url: linked,
      }) as Service,
    ]
  })
}

function faqPage(input: PageGraphInput, url: string): FAQPage | undefined {
  const questions = input.page.layout
    .filter((block): block is FaqBlock => block.blockType === 'faq')
    .flatMap((block) => block.items ?? [])
    .filter((item) => item.question && item.answer)
  if (questions.length === 0) return undefined
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
      name: item.question,
    })),
  }
}
