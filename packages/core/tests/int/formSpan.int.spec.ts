import { describe, expect, it } from 'vitest'

import { fieldSpan } from '../../src/blocks/Contact/fields/span.js'

describe('fieldSpan', () => {
  it('uses the full row for wide or unspecified fields', () => {
    expect(fieldSpan(100)).toBe('sm:col-span-2')
    expect(fieldSpan(undefined)).toBe('sm:col-span-2')
    expect(fieldSpan(null)).toBe('sm:col-span-2')
    expect(fieldSpan('100')).toBe('sm:col-span-2')
  })

  it('uses half a row for narrower fields', () => {
    expect(fieldSpan(50)).toBe('sm:col-span-1')
    expect(fieldSpan('33')).toBe('sm:col-span-1')
  })
})
