import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteConfig } from '../../src/site/site.config'

const { heroFilm } = siteConfig.assets
const local = (url: string) => path.resolve('public', url.replace(/^\//, ''))

describe('film del hero', () => {
  it('declara una durada real', () => {
    expect(heroFilm.duration).toBeGreaterThan(8)
    expect(heroFilm.duration).toBeLessThan(40)
  })

  it('tiene un póster por escena', () => {
    expect(heroFilm.posters).toHaveLength(4)
    for (const poster of heroFilm.posters) {
      expect(existsSync(local(poster.src)), `falta ${poster.src}`).toBe(true)
      expect(poster.width).toBeGreaterThan(poster.height)
    }
  })

  it.each([
    ['src', 10],
    ['srcMobile', 4],
  ] as const)('%s existe y no supera %s MB', (key, limit) => {
    const file = local(heroFilm[key])
    expect(existsSync(file), `falta ${heroFilm[key]}`).toBe(true)
    expect(statSync(file).size / 1024 / 1024).toBeLessThanOrEqual(limit)
  })
})
