import { describe, expect, it } from 'vitest'

import { buildAlternates } from '../../src/utilities/alternates.js'
import { mailtoHref, telHref } from '../../src/utilities/contactHref.js'
import { generateMeta } from '../../src/utilities/generateMeta.js'

describe('buildAlternates', () => {
  it('lists every active locale plus x-default', () => {
    expect(buildAlternates('ca', 'serveis', ['es', 'ca', 'en'], 'es')).toEqual({
      canonical: '/ca/serveis',
      languages: {
        ca: '/ca/serveis',
        en: '/en/serveis',
        es: '/es/serveis',
        'x-default': '/es/serveis',
      },
    })
  })

  it('leaves out a locale that is not active', () => {
    expect(buildAlternates('es', 'serveis', ['es', 'ca'], 'es').languages).toEqual({
      ca: '/ca/serveis',
      es: '/es/serveis',
      'x-default': '/es/serveis',
    })
  })

  it('uses the locale root for the home page', () => {
    expect(buildAlternates('en', 'home', ['es', 'en'], 'es').canonical).toBe('/en')
  })
})

describe('generateMeta', () => {
  it('uses the SEO title and the Open Graph locale', () => {
    const meta = generateMeta({
      activeLocales: ['es', 'ca', 'en'],
      doc: { meta: { description: 'Desc', title: 'Título SEO' }, title: 'Título' },
      locale: 'ca',
      slug: 'serveis',
    })
    expect(meta.title).toBe('Título SEO')
    expect(meta.description).toBe('Desc')
    expect(meta.openGraph).toMatchObject({ locale: 'ca_ES', url: '/ca/serveis' })
  })

  it('falls back to the page title plus the site name', () => {
    const meta = generateMeta({
      activeLocales: ['es', 'ca', 'en'],
      doc: { title: 'Contacto' },
      locale: 'es',
      slug: 'contacto',
    })
    expect(meta.title).toBe('Contacto | Web de Prova')
  })
})

describe('contact hrefs', () => {
  it('normalizes phone numbers', () => {
    expect(telHref('+34 600 000 000')).toBe('tel:+34600000000')
  })

  it('builds mailto links', () => {
    expect(mailtoHref('oficina@example.com')).toBe('mailto:oficina@example.com')
  })
})
