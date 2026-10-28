import { describe, expect, it } from 'vitest'

import { HONEYPOT_FIELD, isHoneypotFilled, toSubmissionData } from '../../src/blocks/Contact/submission.js'

describe('contact submission helpers', () => {
  it('detects a filled honeypot', () => {
    expect(isHoneypotFilled({ [HONEYPOT_FIELD]: 'spam' })).toBe(true)
    expect(isHoneypotFilled({ [HONEYPOT_FIELD]: '   ' })).toBe(false)
    expect(isHoneypotFilled({})).toBe(false)
  })

  it('serializes values and drops the honeypot', () => {
    expect(
      toSubmissionData({ [HONEYPOT_FIELD]: '', email: 'a@b.c', nombre: 'Ana', privacidad: true }),
    ).toEqual([
      { field: 'email', value: 'a@b.c' },
      { field: 'nombre', value: 'Ana' },
      { field: 'privacidad', value: 'true' },
    ])
  })
})
