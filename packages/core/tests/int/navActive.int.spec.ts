import { describe, expect, it } from 'vitest'

import { isActiveNavHref } from '../../src/Header/isActiveNavHref.js'

describe('isActiveNavHref', () => {
  it('matches the exact page', () => {
    expect(isActiveNavHref('/ca/serveis', '/ca/serveis')).toBe(true)
  })

  it('keeps a section active on its nested pages', () => {
    expect(isActiveNavHref('/ca/serveis/neteja', '/ca/serveis')).toBe(true)
  })

  it('does not match a sibling that only shares a prefix', () => {
    expect(isActiveNavHref('/ca/serveis-extra', '/ca/serveis')).toBe(false)
  })

  it('never treats the locale home as the parent of every page', () => {
    expect(isActiveNavHref('/ca/contacto', '/ca')).toBe(false)
    expect(isActiveNavHref('/ca', '/ca')).toBe(true)
  })
})
