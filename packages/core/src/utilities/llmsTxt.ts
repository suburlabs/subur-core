import { supportedLocales } from '../i18n/catalog.js'
import type { Locale } from '../i18n/config.js'
import { pageHref } from '../i18n/paths.js'

export type LlmsPage = {
  byLocale: Partial<Record<Locale, { description?: null | string; title: string }>>
  slug: string
}

export type LlmsFacts = { areaServed: string[]; email?: null | string; locality?: null | string; phone?: null | string }

export type LlmsTxtInput = {
  activeLocales: readonly Locale[]
  defaultLocale: Locale
  facts: LlmsFacts
  legalSlugs: readonly string[]
  pages: readonly LlmsPage[]
  siteName: string
  siteUrl: string
}

/**
 * `llms.txt` (llmstxt.org, spec §22.4): pur a posta, la ruta hi posa les
 * dades i la memòria cau. L'inici primer i la resta per slug; les legals
 * només a `Optional`, en l'idioma per defecte; cap idioma inactiu.
 */
export function buildLlmsTxt(input: LlmsTxtInput): string {
  const base = input.siteUrl.replace(/\/$/, '')
  const legal = new Set(input.legalSlugs)
  const ordered = [...input.pages].sort((a, b) =>
    a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : a.slug.localeCompare(b.slug),
  )
  const link = (locale: Locale, page: LlmsPage) => {
    const entry = page.byLocale[locale]
    if (!entry?.title) return null
    const url = `${base}${pageHref(locale, page.slug)}`
    const description = entry.description?.trim()
    return `- [${entry.title}](${url})${description ? `: ${description}` : ''}`
  }

  const blocks: string[] = [`# ${input.siteName}`]

  const summary = input.pages.find((p) => p.slug === 'home')?.byLocale[input.defaultLocale]?.description?.trim()
  if (summary) blocks.push(`> ${summary}`)

  const facts = [
    input.facts.locality,
    input.facts.areaServed.length > 0 ? input.facts.areaServed.join(', ') : null,
    input.facts.phone,
    input.facts.email,
  ].filter((fact): fact is string => Boolean(fact && fact.trim()))
  if (facts.length > 0) blocks.push(facts.join(' · '))

  for (const locale of input.activeLocales) {
    const lines = ordered.filter((p) => !legal.has(p.slug)).map((p) => link(locale, p)).filter(Boolean)
    if (lines.length > 0) blocks.push([`## ${supportedLocales[locale].name}`, ...lines].join('\n'))
  }

  const optional = ordered
    .filter((p) => legal.has(p.slug))
    .map((p) => link(input.defaultLocale, p))
    .filter(Boolean)
  if (optional.length > 0) blocks.push(['## Optional', ...optional].join('\n'))

  return `${blocks.join('\n\n')}\n`
}
