import { describe, expect, it } from 'vitest'

// Interns del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import { uiDefaults } from '../../../../packages/core/src/i18n/uiDefaults.js'
import type { SeedRefs } from '../../../../packages/core/src/seed/types.js'
import { content, type PageSlug, pageSlugs } from '../../src/site/seed/content'
import { type MediaKey, mediaKeys } from '../../src/site/seed/media'

// A la demo, el contingut de cada idioma és `content.byLocale` (el format de `runSeed`).
const seedContent = content.byLocale
type Refs = SeedRefs<PageSlug, MediaKey>

const refs: Refs = {
  formId: 1,
  media: Object.fromEntries(mediaKeys.map((key, index) => [key, index + 100])) as Refs['media'],
  pages: Object.fromEntries(pageSlugs.map((slug, index) => [slug, index + 10])) as Refs['pages'],
}

const collectKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys))
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key)
      collectKeys(child, keys)
    }
  }
  return keys
}

const collectValuesForKey = (value: unknown, targetKey: string, values: unknown[] = []): unknown[] => {
  if (Array.isArray(value)) value.forEach((item) => collectValuesForKey(item, targetKey, values))
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === targetKey) values.push(child)
      collectValuesForKey(child, targetKey, values)
    }
  }
  return values
}

describe.each(['es', 'ca', 'en'] as const)('content rules (%s)', (locale) => {
  const build = seedContent[locale]!.build(refs)

  it('never uses eyebrows', () => {
    expect(collectKeys(build).has('eyebrow')).toBe(false)
  })

  it('states when each home quality check happens', () => {
    const list = build.pages.home.layout.find((block) => block.blockType === 'featureList')
    if (list?.blockType !== 'featureList') throw new Error('missing featureList')
    expect(list.items.map((item) => item.moment)).toEqual(['before', 'ongoing', 'after', 'during'])
  })

  it('translates the moment labels', () => {
    // Els textos dels moments ja no els porta el seed: són els del nucli
    // (Tasca 6), coberts a `uiDefaults.int.spec.ts` del paquet.
    expect(uiDefaults.momentBefore.text[locale]).toBeTruthy()
    expect(uiDefaults.momentOngoing.text[locale]).toBeTruthy()
  })

  it('never uses the sparkles icon', () => {
    expect(collectValuesForKey(build, 'icon')).not.toContain('sparkles')
  })
})

describe('nombres de escena del hero', () => {
  it.each(['es', 'ca', 'en'] as const)('existen y son cortos en %s', (locale) => {
    const content = seedContent[locale]
    expect(content).toBeDefined()
    const home = content!.build(refs).pages.home
    const hero = home.layout?.find((block) => block.blockType === 'scrollHero')
    if (!hero || hero.blockType !== 'scrollHero') throw new Error('falta el bloque scrollHero')
    expect(hero.beats).toHaveLength(4)
    for (const beat of hero.beats) {
      expect(beat.label?.trim().length ?? 0).toBeGreaterThan(2)
      expect(beat.label!.trim().split(/\s+/).length).toBeLessThanOrEqual(5)
    }
  })
})

describe('redes sociales del pie', () => {
  it.each(['es', 'ca', 'en'] as const)(
    'solo publica el WhatsApp derivado del teléfono en %s, sin Instagram/Facebook/LinkedIn inventados',
    (locale) => {
      const build = seedContent[locale]!.build(refs)
      // El WhatsApp derivat del telèfon de la demo (+34 600 000 000).
      expect(build.siteSettings.socials).toEqual([
        { platform: 'whatsapp', url: 'https://wa.me/34600000000' },
      ])
    },
  )
})

describe('opiniones de clientes', () => {
  // La demo en publica tres (Task 15); l'arrel, vuit.
  it.each(['es', 'ca', 'en'] as const)('la home publica las tres con firma en %s', (locale) => {
    const content = seedContent[locale]
    expect(content).toBeDefined()
    const home = content!.build(refs).pages.home
    const block = home.layout?.find((item) => item.blockType === 'testimonials')
    if (!block || block.blockType !== 'testimonials') throw new Error('falta el bloque testimonials')
    expect(block.items).toHaveLength(3)
    for (const item of block.items) {
      expect(item.quote?.trim().length ?? 0).toBeGreaterThan(40)
      expect(item.author).toBeTruthy()
    }
  })

  it('publica la misma firma en los tres idiomas, porque un nombre no se traduce', () => {
    const authors = (locale: 'ca' | 'en' | 'es') => {
      const home = seedContent[locale]!.build(refs).pages.home
      const block = home.layout?.find((item) => item.blockType === 'testimonials')
      if (!block || block.blockType !== 'testimonials') throw new Error('falta el bloque')
      return block.items.map((item) => item.author)
    }
    expect(authors('es')[0]).toBe('Marta R.')
    expect(authors('ca')).toEqual(authors('es'))
    expect(authors('en')).toEqual(authors('es'))
  })
})
