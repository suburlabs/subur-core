import { describe, expect, it } from 'vitest'

import { buildSchemaGraph, type SchemaInput } from '../../src/seo/schema.js'

const input: SchemaInput = {
  activeLocales: ['es', 'ca', 'en'],
  locale: 'es',
  logoUrl: 'https://fixture.example/site/logo-lockup.webp',
  schemaType: 'LocalBusiness',
  settings: {
    address: 'Calle Ejemplo 1',
    email: 'hola@fixture.example',
    googleBusinessProfile: 'https://maps.app.goo.gl/x',
    hours: 'L-V 9-19',
    location: {
      addressCountry: 'ES',
      addressLocality: 'Vila Exemple',
      addressRegion: 'Exemple',
      areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }],
      geo: { latitude: 40.1234, longitude: 0.5678 },
      postalCode: '00000',
      streetAddress: 'Calle Ejemplo 1, local 1',
    },
    phone: '+34 600 000 000',
    socials: [{ platform: 'instagram', url: 'https://instagram.com/fixture' }],
  },
  siteName: 'Web de Prova',
  siteUrl: 'https://fixture.example',
}

// `Graph['@graph']` és `readonly Thing[]` a schema-dts 2.0.0: cal passar per
// `unknown` per llegir-ne els nodes com a objectes plans.
const nodes = (g: ReturnType<typeof buildSchemaGraph>) =>
  g['@graph'] as unknown as Array<Record<string, unknown>>
const byType = (g: ReturnType<typeof buildSchemaGraph>, type: string) =>
  nodes(g).find((n) => n['@type'] === type)

describe('buildSchemaGraph', () => {
  it('Organization, WebSite i el negoci local, amb ids estables i referències creuades', () => {
    const g = buildSchemaGraph(input)
    expect(g['@context']).toBe('https://schema.org')
    const org = byType(g, 'Organization')!
    const site = byType(g, 'WebSite')!
    const biz = byType(g, 'LocalBusiness')!
    expect(org['@id']).toBe('https://fixture.example/#organization')
    expect(site['publisher']).toEqual({ '@id': 'https://fixture.example/#organization' })
    expect(site['inLanguage']).toEqual(['es', 'ca', 'en'])
    expect(biz['@id']).toBe('https://fixture.example/#business')
    expect(biz['telephone']).toBe('+34 600 000 000')
    expect(biz['address']).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'ES',
      addressLocality: 'Vila Exemple',
      addressRegion: 'Exemple',
      postalCode: '00000',
      streetAddress: 'Calle Ejemplo 1, local 1',
    })
    expect(biz['geo']).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 40.1234,
      longitude: 0.5678,
    })
    expect(biz['areaServed']).toEqual([
      { '@type': 'City', name: 'Vila Exemple' },
      { '@type': 'City', name: 'Poble Exemple' },
    ])
    expect(org['sameAs']).toEqual(['https://instagram.com/fixture', 'https://maps.app.goo.gl/x'])
    expect(org['logo']).toBe('https://fixture.example/site/logo-lockup.webp')
  })

  it('el subtipus configurat mana', () => {
    const g = buildSchemaGraph({ ...input, schemaType: 'ProfessionalService' })
    expect(byType(g, 'ProfessionalService')).toBeDefined()
    expect(byType(g, 'LocalBusiness')).toBeUndefined()
  })

  it('camps buits no generen claus buides ni entrades buides', () => {
    const g = buildSchemaGraph({
      ...input,
      settings: {
        ...input.settings,
        googleBusinessProfile: null,
        location: { areaServed: [] },
        socials: [],
      },
    })
    const biz = byType(g, 'LocalBusiness')!
    const org = byType(g, 'Organization')!
    expect(biz).not.toHaveProperty('address')
    expect(biz).not.toHaveProperty('geo')
    expect(biz).not.toHaveProperty('areaServed')
    expect(org).not.toHaveProperty('sameAs')
  })

  it('un país sense carrer encara dóna una PostalAddress mínima', () => {
    const g = buildSchemaGraph({
      ...input,
      settings: {
        ...input.settings,
        location: { addressCountry: 'ES', addressLocality: 'Vila Exemple' },
      },
    })
    expect(byType(g, 'LocalBusiness')!['address']).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'ES',
      addressLocality: 'Vila Exemple',
    })
  })

  it('priceRange només si té valor', () => {
    const withPrice = buildSchemaGraph({
      ...input,
      settings: { ...input.settings, location: { ...input.settings.location, priceRange: '€€' } },
    })
    expect(byType(withPrice, 'LocalBusiness')!['priceRange']).toBe('€€')
    expect(byType(buildSchemaGraph(input), 'LocalBusiness')).not.toHaveProperty('priceRange')
  })
})
