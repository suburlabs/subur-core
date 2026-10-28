import { describe, expect, it } from 'vitest'

import { allLayoutBlocks, enabledBlockSlugs, isBlockEnabled } from '../../src/blocks/registry.js'
import { createPages } from '../../src/config/pages.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

const off = { ...siteConfig, optionalBlocks: { scrollHero: false, taskCatalog: false } }
const layoutOf = (pages: ReturnType<typeof createPages>) => {
  const flat = (fields: unknown[]): unknown[] => fields.flatMap((f) => { const x = f as { fields?: unknown[]; tabs?: Array<{ fields: unknown[] }> }; return x.tabs ? flat(x.tabs.flatMap((t) => t.fields)) : x.fields && !('name' in (f as object)) ? flat(x.fields) : [f] })
  return flat(pages.fields).find((f) => (f as { name?: string }).name === 'layout') as { blocks: Array<{ slug: string }>; filterOptions: (args: never) => string[] }
}

describe('esquema únic per a tots els clients (spec §3.3)', () => {
  it('sempre els 12 blocs registrats, també amb els opcionals desactivats', () => {
    expect(allLayoutBlocks).toHaveLength(12)
    expect(layoutOf(createPages(off)).blocks.map((b) => b.slug)).toEqual(allLayoutBlocks.map((b) => b.slug))
  })
  it('optionalBlocks només filtra: filterOptions i isBlockEnabled', () => {
    expect(enabledBlockSlugs(off.optionalBlocks)).toHaveLength(10)
    expect(enabledBlockSlugs(siteConfig.optionalBlocks)).toHaveLength(12)
    expect(layoutOf(createPages(off)).filterOptions({} as never)).toEqual(enabledBlockSlugs(off.optionalBlocks))
    expect(isBlockEnabled('taskCatalog', off.optionalBlocks)).toBe(false)
    expect(isBlockEnabled('note', off.optionalBlocks)).toBe(true)
  })
  it('isBlockEnabled només mira les claus pròpies del registre i torna sempre un booleà', () => {
    expect(isBlockEnabled('toString', {} as never)).toBe(true)
    expect(isBlockEnabled('scrollHero', {} as never)).toBe(false)
  })
})
