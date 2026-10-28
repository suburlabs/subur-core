import { describe, expect, it } from 'vitest'

import { buildPagesSitemap } from '../../src/utilities/pagesSitemap.js'

const siteUrl = 'https://ejemplo.dev'

const pages = [
  { slug: 'home', updatedAt: '2026-09-01T00:00:00.000Z' },
  { slug: 'servicios', updatedAt: '2026-09-02T00:00:00.000Z' },
]

const hreflangs = (entry: { alternateRefs?: { hreflang: string }[] }) =>
  (entry.alternateRefs ?? []).map((ref) => ref.hreflang)

describe('buildPagesSitemap', () => {
  it('con un subconjunto de idiomas, no publica ni enlaza los que no están activos', () => {
    const entries = buildPagesSitemap({ activeLocales: ['es', 'ca'], defaultLocale: 'es', pages, siteUrl })

    // Dos idiomas por página, nunca `/en/`.
    expect(entries).toHaveLength(4)
    expect(entries.map((entry) => entry.loc)).toEqual([
      `${siteUrl}/es`,
      `${siteUrl}/ca`,
      `${siteUrl}/es/servicios`,
      `${siteUrl}/ca/servicios`,
    ])
    expect(entries.some((entry) => entry.loc.includes('/en'))).toBe(false)

    for (const entry of entries) {
      expect(hreflangs(entry)).toEqual(['es', 'ca', 'x-default'])
      expect(entry.alternateRefs?.some((ref) => ref.href.includes('/en'))).toBe(false)
    }
  })

  it('apunta x-default al idioma por defecto', () => {
    const entries = buildPagesSitemap({ activeLocales: ['es', 'ca'], defaultLocale: 'es', pages, siteUrl })
    const xDefault = entries[3].alternateRefs?.find((ref) => ref.hreflang === 'x-default')
    expect(xDefault?.href).toBe(`${siteUrl}/es/servicios`)
    expect(xDefault?.hrefIsAbsolute).toBe(true)
  })

  it('con el catálogo entero, publica las tres variantes de cada página', () => {
    const entries = buildPagesSitemap({ activeLocales: ['es', 'ca', 'en'], defaultLocale: 'es', pages, siteUrl })

    expect(entries).toHaveLength(6)
    expect(entries.map((entry) => entry.loc)).toEqual([
      `${siteUrl}/es`,
      `${siteUrl}/ca`,
      `${siteUrl}/en`,
      `${siteUrl}/es/servicios`,
      `${siteUrl}/ca/servicios`,
      `${siteUrl}/en/servicios`,
    ])
    for (const entry of entries) {
      expect(hreflangs(entry)).toEqual(['es', 'ca', 'en', 'x-default'])
    }
  })

  it('conserva la fecha de cada página y descarta las que no tienen slug', () => {
    const entries = buildPagesSitemap({
      activeLocales: ['es'],
      defaultLocale: 'es',
      pages: [...pages, { slug: null, updatedAt: '2026-09-03T00:00:00.000Z' }],
      siteUrl,
    })

    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.lastmod)).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
    ])
  })
})
