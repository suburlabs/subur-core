import { describe, expect, it } from 'vitest'

import { mergeLocalized } from '../../src/seed/mergeLocalized.js'

describe('mergeLocalized', () => {
  it('keeps ids and structure from the base document', () => {
    const base = {
      layout: [
        { blockType: 'note', id: 'a1', text: 'Texto', title: 'Título' },
        { blockType: 'statement', id: 'b2', text: 'Frase' },
      ],
      title: 'Inicio',
    }
    const localized = {
      layout: [
        { blockType: 'note', text: 'Text', title: 'Títol' },
        { blockType: 'statement', text: 'Frase CA' },
      ],
      title: 'Inici',
    }

    expect(mergeLocalized(base, localized)).toEqual({
      layout: [
        { blockType: 'note', id: 'a1', text: 'Text', title: 'Títol' },
        { blockType: 'statement', id: 'b2', text: 'Frase CA' },
      ],
      title: 'Inici',
    })
  })

  it('replaces lexical rich text wholesale', () => {
    const base = { content: { root: { children: [1, 2, 3] } }, id: 1 }
    const localized = { content: { root: { children: [9] } } }
    expect(mergeLocalized(base, localized)).toEqual({ content: { root: { children: [9] } }, id: 1 })
  })

  it('keeps base values that are missing in the translation', () => {
    expect(mergeLocalized({ a: 'x', b: 'y' }, { a: 'z' })).toEqual({ a: 'z', b: 'y' })
  })
})
