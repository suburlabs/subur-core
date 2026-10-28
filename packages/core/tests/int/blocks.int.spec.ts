import { describe, expect, it } from 'vitest'

import { allLayoutBlocks, isBlockEnabled } from '../../src/blocks/registry.js'

// La llista de blocs actius d'un client: tots els blocs, filtrats per `optionalBlocks` (mateix ordre).
const getLayoutBlocks = (o: { scrollHero: boolean; taskCatalog: boolean }) => allLayoutBlocks.filter((b) => isBlockEnabled(b.slug, o))
import { servicesGridBlock } from '../../src/blocks/ServicesGrid/config.js'
import { testimonialsBlock } from '../../src/blocks/Testimonials/config.js'
import { iconMap } from '../../src/components/Icon/index.js'
import { iconNames } from '../../src/fields/icon.js'

describe('block registry', () => {
  it('always includes the core blocks', () => {
    const slugs = getLayoutBlocks({ scrollHero: false, taskCatalog: false }).map((b) => b.slug)
    expect(slugs).toEqual([
      'pageHero',
      'statement',
      'servicesGrid',
      'featureList',
      'testimonials',
      'note',
      'ctaBand',
      'faq',
      'contact',
      'richTextSection',
    ])
  })

  it('adds optional blocks when enabled', () => {
    const slugs = getLayoutBlocks({ scrollHero: true, taskCatalog: true }).map((b) => b.slug)
    expect(slugs[0]).toBe('scrollHero')
    expect(slugs).toContain('taskCatalog')
  })

  it('inclou faq amb qualsevol combinació d’optionalBlocks', () => {
    for (const scrollHero of [false, true]) {
      for (const taskCatalog of [false, true]) {
        expect(getLayoutBlocks({ scrollHero, taskCatalog }).map((b) => b.slug)).toContain('faq')
      }
    }
  })
})

describe('icons', () => {
  it('maps every selectable icon to a component', () => {
    for (const name of iconNames) {
      expect(iconMap[name]).toBeDefined()
    }
  })
})

describe('servicesGrid', () => {
  it('permite una imagen opcional por servicio', () => {
    const items = servicesGridBlock.fields.find(
      (field) => 'name' in field && field.name === 'items',
    )
    if (!items || items.type !== 'array') throw new Error('falta el array de servicios')
    const image = items.fields.find((field) => 'name' in field && field.name === 'image')
    expect(image).toBeDefined()
    expect(image?.type).toBe('upload')
    expect(image && 'required' in image ? image.required : false).toBeFalsy()
  })
})

describe('testimonials', () => {
  it('exige cita y autor, y no localiza el nombre', () => {
    const items = testimonialsBlock.fields.find((field) => 'name' in field && field.name === 'items')
    if (!items || items.type !== 'array') throw new Error('falta el array de testimonios')

    const field = (name: string) => items.fields.find((item) => 'name' in item && item.name === name)

    expect(field('quote')).toMatchObject({ localized: true, required: true, type: 'textarea' })
    expect(field('author')).toMatchObject({ required: true, type: 'text' })
    expect(field('author')).not.toMatchObject({ localized: true })
    expect(field('detail')).toMatchObject({ localized: true, type: 'text' })
  })
})
