import { describe, expect, it } from 'vitest'

import { Media } from '../../src/collections/Media.js'

/**
 * Els fitxers pujats es serveixen públicament des del mateix origen: un SVG o
 * un HTML obert directament hi executaria scripts.
 */
describe('media uploads', () => {
  const upload = typeof Media.upload === 'object' ? Media.upload : undefined

  it('only accepts an explicit list of raster images and video', () => {
    expect(upload?.mimeTypes).toBeDefined()
    for (const type of upload?.mimeTypes ?? []) {
      expect(type).toMatch(/^(image|video)\/[a-z0-9.+-]+$/)
      expect(type).not.toContain('svg')
    }
  })
})
