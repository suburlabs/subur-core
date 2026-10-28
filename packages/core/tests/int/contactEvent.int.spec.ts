import { afterEach, describe, expect, it, vi } from 'vitest'

import { contactEventFor } from '../../src/analytics/contactEvent.js'
import { trackEvent } from '../../src/analytics/track.js'

describe('contactEventFor', () => {
  it.each([
    ['tel:+34600000000', 'contact-phone'],
    ['TEL:+34600000000', 'contact-phone'],
    ['mailto:hola@x.example', 'contact-email'],
    ['MAILTO:hola@x.example', 'contact-email'],
    ['https://wa.me/34600000000', 'contact-whatsapp'],
    ['https://api.whatsapp.com/send?phone=34600000000', 'contact-whatsapp'],
    ['whatsapp://send?phone=34600000000', 'contact-whatsapp'],
    ['/es/contacto', null],
    ['https://instagram.com/x', null],
    ['https://example.com/wa.me/trap', null],
  ])('%s → %s', (href, expected) => {
    expect(contactEventFor(href)).toBe(expected)
  })
})

describe('trackEvent', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sense Umami carregat no fa res ni llença', () => {
    vi.stubGlobal('window', {})
    expect(() => trackEvent('contact-phone')).not.toThrow()
  })

  it('amb Umami, envia el nom i res més', () => {
    const track = vi.fn()
    vi.stubGlobal('window', { umami: { track } })
    trackEvent('contact-form')
    expect(track).toHaveBeenCalledWith('contact-form')
  })
})
