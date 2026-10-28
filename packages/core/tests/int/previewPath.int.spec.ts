import { describe, expect, it } from 'vitest'

import { isSafePreviewPath } from '../../src/utilities/isSafePreviewPath.js'

describe('isSafePreviewPath', () => {
  it('accepts paths inside this site', () => {
    expect(isSafePreviewPath('/es')).toBe(true)
    expect(isSafePreviewPath('/ca/contacto?x=1#y')).toBe(true)
  })

  it('rejects anything a browser would resolve to another origin', () => {
    for (const path of ['//evil.example', '/\\evil.example', '/\t/evil.example', 'https://evil.example', 'evil', '']) {
      expect(isSafePreviewPath(path), path).toBe(false)
    }
  })
})
