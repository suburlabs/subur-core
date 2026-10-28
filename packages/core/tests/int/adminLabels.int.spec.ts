import { describe, expect, it } from 'vitest'

import { allLayoutBlocks, isBlockEnabled } from '../../src/blocks/registry.js'
import { Media } from '../../src/collections/Media.js'
import { Users } from '../../src/collections/Users/index.js'
import { Footer } from '../../src/Footer/config.js'
import { iconField } from '../../src/fields/icon.js'
import { link } from '../../src/fields/link.js'
import { Header } from '../../src/Header/config.js'
import { locales } from '../../src/i18n/config.js'
import { SiteSettings } from '../../src/SiteSettings/config.js'
import { createPages } from '../../src/config/pages.js'
import { createSubscription } from '../../src/config/subscription.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

// Al paquet, Pages i Subscription són fàbriques: es construeixen amb la configuració del client de prova.
const Pages = createPages(siteConfig)
const Subscription = createSubscription(siteConfig)

const LABEL_KEYS = new Set(['description', 'group', 'label', 'plural', 'singular'])

const isComplete = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  locales.every((locale) => Boolean((value as Record<string, string>)[locale]))

/**
 * Recorre una configuració i torna el camí de cada etiqueta que sigui una
 * cadena solta o un objecte sense algun idioma del catàleg. `false`, funcions
 * i valors absents són vàlids. Els blocks s'exclouen aquí: són de la Tasca 8.
 */
export function findBareLabels(node: unknown, path = '', skipBlocks = true): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => findBareLabels(item, `${path}[${index}]`, skipBlocks))
  }
  if (typeof node !== 'object' || node === null) return []

  return Object.entries(node).flatMap(([key, value]) => {
    const here = `${path}.${key}`
    if (skipBlocks && key === 'blocks') return []
    if (LABEL_KEYS.has(key)) {
      if (value === false || value === undefined || typeof value === 'function') return []
      if (typeof value === 'string') return [here]
      return isComplete(value) ? [] : [here]
    }
    return findBareLabels(value, here, skipBlocks)
  })
}

const cases: Array<[string, unknown]> = [
  ['pages', Pages],
  ['media', Media],
  ['users', Users],
  ['site-settings', SiteSettings],
  ['header', Header],
  ['footer', Footer],
  ['subscription', Subscription],
]

describe('etiquetas del panel', () => {
  it.each(cases)('%s: todas en todos los idiomas del catálogo', (_name, config) => {
    expect(findBareLabels(config)).toEqual([])
  })
})

describe('etiquetas de blocks y campos compartidos', () => {
  const blocks = allLayoutBlocks.filter((b) => isBlockEnabled(b.slug, { scrollHero: true, taskCatalog: true }))

  it.each(blocks.map((block) => [block.slug, block] as const))('%s', (_slug, block) => {
    expect(findBareLabels(block, '', false)).toEqual([])
  })

  it('campos compartidos', () => {
    expect(findBareLabels(link(), '', false)).toEqual([])
    expect(findBareLabels(iconField(), '', false)).toEqual([])
  })

  it('etiquetas que ponemos a los plugins', async () => {
    const { pluginLabels } = await import('../../src/plugins/index.js')
    expect(findBareLabels(pluginLabels, '', false)).toEqual([])
  })
})

/**
 * `findBareLabels` recorre el que hi ha: una etiqueta absent no deixa cap
 * cadena solta a trobar. Una col·lecció sense `labels` no la genera el
 * CMS en castellà, català o anglès — la deriva del `slug` en anglès
 * sempre (`formatLabels`), fent-la il·legible per a admins en es/ca. Aquesta
 * prova comprova directament que cada col·lecció i cada global de l'abast
 * tenen l'etiqueta present i completa.
 */
type LabeledCollection = { labels?: { plural?: unknown; singular?: unknown } }
type LabeledGlobal = { label?: unknown }

const collectionsInScope: Array<[string, LabeledCollection]> = [
  ['pages', Pages],
  ['media', Media],
  ['users', Users],
]

const globalsInScope: Array<[string, LabeledGlobal]> = [
  ['site-settings', SiteSettings],
  ['header', Header],
  ['footer', Footer],
  ['subscription', Subscription],
]

describe('etiquetas de colecciones y globales presentes', () => {
  it.each(collectionsInScope)('%s: labels.plural y labels.singular completos', (_name, config) => {
    expect(isComplete(config.labels?.plural)).toBe(true)
    expect(isComplete(config.labels?.singular)).toBe(true)
  })

  it.each(globalsInScope)('%s: label completo', (_name, config) => {
    expect(isComplete(config.label)).toBe(true)
  })
})

/**
 * Mateix risc que a dalt, aplicat als blocks i a les col·leccions que
 * afegeixen els plugins: un block sense `labels`, o una col·lecció de
 * plugin amb l'etiqueta per defecte del fabricant, cauria en una cadena
 * anglesa il·legible per a admins en es/ca sense que `findBareLabels` ho
 * detecti (no hi ha res «solt» a trobar quan l'etiqueta és absent).
 */
describe('etiquetas de bloques y colecciones de plugins presentes', () => {
  const blocks = allLayoutBlocks.filter((b) => isBlockEnabled(b.slug, { scrollHero: true, taskCatalog: true }))

  it.each(blocks.map((block) => [block.slug, block] as const))(
    '%s: labels.plural y labels.singular completos',
    (_slug, block) => {
      expect(isComplete(block.labels?.plural)).toBe(true)
      expect(isComplete(block.labels?.singular)).toBe(true)
    },
  )

  it('redirects, forms y form-submissions: labels.plural y labels.singular completos', async () => {
    const { pluginLabels } = await import('../../src/plugins/index.js')
    for (const labels of [pluginLabels.redirects.labels, pluginLabels.forms.labels, pluginLabels.formSubmissions.labels]) {
      expect(isComplete(labels.plural)).toBe(true)
      expect(isComplete(labels.singular)).toBe(true)
    }
  })
})
