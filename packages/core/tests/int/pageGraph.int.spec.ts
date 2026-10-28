import { describe, expect, it } from 'vitest'

import { buildPageGraph, type PageGraphInput } from '../../src/seo/pageGraph.js'

const servicesGrid = {
  blockType: 'servicesGrid' as const,
  items: [
    { title: 'Limpieza', summary: 'Limpieza entre estancias', page: { id: 2, slug: 'limpieza' } },
    { title: 'Reparaciones', summary: '', page: null },
    { title: '', summary: 'sin título: no sale' },
  ],
}

const base: PageGraphInput = {
  areaServed: ['Vila Exemple', 'Poble Exemple'],
  homeTitle: 'Inicio',
  locale: 'es',
  page: {
    layout: [servicesGrid] as never,
    meta: { description: 'Servicios en Vila Exemple' },
    slug: 'home',
    title: 'Inicio',
  },
  modules: [],
  siteUrl: 'https://fixture.example/',
}

type Node = Record<string, unknown>
const nodes = (input: PageGraphInput) => buildPageGraph(input)['@graph'] as unknown as Node[]
const ofType = (input: PageGraphInput, type: string) => nodes(input).filter((n) => n['@type'] === type)

describe('buildPageGraph', () => {
  it('WebPage enllaçat amb el WebSite del layout, sense BreadcrumbList a l’inici', () => {
    const [page] = ofType(base, 'WebPage')
    expect(page).toEqual({
      '@type': 'WebPage',
      '@id': 'https://fixture.example/es#webpage',
      description: 'Servicios en Vila Exemple',
      inLanguage: 'es',
      isPartOf: { '@id': 'https://fixture.example/#website' },
      name: 'Inicio',
      url: 'https://fixture.example/es',
    })
    expect(ofType(base, 'BreadcrumbList')).toHaveLength(0)
  })

  it('BreadcrumbList de dos nivells a qualsevol altra pàgina, amb qualsevol mòdul', () => {
    const input = { ...base, page: { ...base.page, layout: [], slug: 'contacto', title: 'Contacto' } }
    const [crumbs] = ofType(input, 'BreadcrumbList')
    expect(crumbs).toEqual({
      '@type': 'BreadcrumbList',
      '@id': 'https://fixture.example/es/contacto#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', item: 'https://fixture.example/es', name: 'Inicio', position: 1 },
        { '@type': 'ListItem', item: 'https://fixture.example/es/contacto', name: 'Contacto', position: 2 },
      ],
    })
    expect(ofType(input, 'WebPage')[0]['breadcrumb']).toEqual({
      '@id': 'https://fixture.example/es/contacto#breadcrumb',
    })
  })

  it('Service només amb el mòdul advanced-seo, des dels ítems amb títol del servicesGrid', () => {
    expect(ofType(base, 'Service')).toHaveLength(0)
    const services = ofType({ ...base, modules: ['advanced-seo'] }, 'Service')
    expect(services).toEqual([
      {
        '@type': 'Service',
        '@id': 'https://fixture.example/es/limpieza#service',
        areaServed: [
          { '@type': 'City', name: 'Vila Exemple' },
          { '@type': 'City', name: 'Poble Exemple' },
        ],
        description: 'Limpieza entre estancias',
        name: 'Limpieza',
        provider: { '@id': 'https://fixture.example/#business' },
        url: 'https://fixture.example/es/limpieza',
      },
      {
        '@type': 'Service',
        '@id': 'https://fixture.example/es#service-2',
        areaServed: [
          { '@type': 'City', name: 'Vila Exemple' },
          { '@type': 'City', name: 'Poble Exemple' },
        ],
        name: 'Reparaciones',
        provider: { '@id': 'https://fixture.example/#business' },
      },
    ])
  })

  it('dos ítems que enllacen la mateixa pàgina no repeteixen @id', () => {
    const input: PageGraphInput = {
      ...base,
      page: {
        ...base.page,
        layout: [
          {
            blockType: 'servicesGrid' as const,
            items: [
              { title: 'Limpieza', summary: 'Limpieza entre estancias', page: { id: 2, slug: 'limpieza' } },
              { title: 'Control de calidad', summary: 'Informes de estado', page: { id: 2, slug: 'limpieza' } },
            ],
          },
        ] as never,
      },
      modules: ['advanced-seo'],
    }
    const ids = ofType(input, 'Service').map((service) => service['@id'])
    expect(ids).toEqual(['https://fixture.example/es/limpieza#service', 'https://fixture.example/es/limpieza#service-2'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cap clau buida: sense descripció ni zona de servei no surten', () => {
    const input: PageGraphInput = {
      ...base,
      areaServed: [],
      page: { ...base.page, meta: { description: '' } },
      modules: ['advanced-seo'],
    }
    expect(ofType(input, 'WebPage')[0]).not.toHaveProperty('description')
    for (const service of ofType(input, 'Service')) expect(service).not.toHaveProperty('areaServed')
  })

  it('no repeteix cap node del graf del layout', () => {
    const types = nodes({ ...base, modules: ['advanced-seo'] }).map((n) => n['@type'])
    expect(types).not.toContain('Organization')
    expect(types).not.toContain('WebSite')
    expect(types).not.toContain('LocalBusiness')
  })
})

const faq = (items: Array<[string, string]>) => ({
  blockType: 'faq' as const,
  items: items.map(([question, answer]) => ({ answer, question })),
})

describe('FAQPage', () => {
  const input: PageGraphInput = {
    ...base,
    page: {
      ...base.page,
      layout: [faq([['¿Trabajan en agosto?', 'Sí, todo el año.']]), faq([['¿Hay mínimo?', 'Una hora.']])] as never,
      slug: 'preguntas',
      title: 'Preguntas',
    },
  }

  it('només amb el mòdul advanced-seo', () => {
    expect(ofType(input, 'FAQPage')).toHaveLength(0)
  })

  it('un sol node per pàgina amb totes les preguntes, en ordre', () => {
    const faqs = ofType({ ...input, modules: ['advanced-seo'] }, 'FAQPage')
    expect(faqs).toEqual([
      {
        '@type': 'FAQPage',
        '@id': 'https://fixture.example/es/preguntas#faq',
        mainEntity: [
          { '@type': 'Question', acceptedAnswer: { '@type': 'Answer', text: 'Sí, todo el año.' }, name: '¿Trabajan en agosto?' },
          { '@type': 'Question', acceptedAnswer: { '@type': 'Answer', text: 'Una hora.' }, name: '¿Hay mínimo?' },
        ],
      },
    ])
  })

  it('sense preguntes vàlides, cap FAQPage', () => {
    const empty = { ...input, modules: ['advanced-seo'], page: { ...input.page, layout: [faq([['', '']])] as never } }
    expect(ofType(empty, 'FAQPage')).toHaveLength(0)
  })
})

describe('el mòdul, no el pla', () => {
  it('amb ai-visibility però sense advanced-seo, cap Service ni FAQPage', () => {
    const input: PageGraphInput = {
      ...base,
      modules: ['ai-visibility'],
      page: { ...base.page, layout: [servicesGrid, faq([['¿Trabajan en agosto?', 'Sí, todo el año.']])] as never },
    }
    const types = nodes(input).map((n) => n['@type'])
    expect(types).not.toContain('Service')
    expect(types).not.toContain('FAQPage')
    expect(types).toContain('WebPage')
  })
})
