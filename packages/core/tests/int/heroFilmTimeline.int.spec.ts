import { describe, expect, it } from 'vitest'

import { beatAtProgress, beatSegments } from '../../src/blocks/ScrollHero/film.js'

describe('beatSegments', () => {
  it('reparte la película en partes iguales', () => {
    const segments = beatSegments(4)
    expect(segments).toHaveLength(4)
    expect(segments[0]).toEqual({ end: 0.25, start: 0 })
    expect(segments[3]).toEqual({ end: 1, start: 0.75 })
  })

  it('no se rompe sin escenas', () => {
    expect(beatSegments(0)).toEqual([])
  })
})

describe('beatAtProgress', () => {
  it('sigue el avance del scroll', () => {
    expect(beatAtProgress(0, 4)).toBe(0)
    expect(beatAtProgress(0.3, 4)).toBe(1)
    expect(beatAtProgress(0.99, 4)).toBe(3)
    expect(beatAtProgress(2, 4)).toBe(3)
    expect(beatAtProgress(-1, 4)).toBe(0)
  })
})
