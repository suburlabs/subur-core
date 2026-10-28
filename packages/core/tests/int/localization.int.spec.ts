import config from '../fixtures/app/src/payload.config.js'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let pageId: number

describe('content localization', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const page = await payload.create({
      collection: 'pages',
      context: { disableRevalidate: true },
      data: { layout: [], slug: 'test-localization', title: 'Título ES' },
      draft: true,
      locale: 'es',
    })
    pageId = page.id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'pages', context: { disableRevalidate: true }, id: pageId })
  })

  it('falls back to Spanish when a translation is missing', async () => {
    const page = await payload.findByID({
      collection: 'pages',
      draft: true,
      fallbackLocale: 'es',
      id: pageId,
      locale: 'en',
    })
    expect(page.title).toBe('Título ES')
  })

  it('stores translations per locale', async () => {
    await payload.update({
      collection: 'pages',
      context: { disableRevalidate: true },
      data: { title: 'Title EN' },
      draft: true,
      id: pageId,
      locale: 'en',
    })
    const en = await payload.findByID({ collection: 'pages', draft: true, id: pageId, locale: 'en' })
    const es = await payload.findByID({ collection: 'pages', draft: true, id: pageId, locale: 'es' })
    expect(en.title).toBe('Title EN')
    expect(es.title).toBe('Título ES')
  })

  it('exposes site settings as a localized global', async () => {
    const settings = await payload.findGlobal({ slug: 'site-settings', locale: 'ca' })
    expect(settings).toBeDefined()
  })
})
