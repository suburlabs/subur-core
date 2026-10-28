// core/packages/core/tests/int/contactHref.int.spec.ts — enllaços de telèfon i correu tolerants a uns ajustos encara buits
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// L'enllaç de preferències de galetes exigeix el proveïdor de c15t; com a `footerCreditRender`, fora d'ell no es pinta.
vi.mock('../../src/components/CookiePreferencesTrigger/index.js', () => ({ CookiePreferencesTrigger: () => null }))

import { Contact } from '../../src/blocks/Contact/Component.js'
import { CtaBand } from '../../src/blocks/CtaBand/Component.js'
import { Footer } from '../../src/Footer/Component.js'
import { mailtoHref, telHref } from '../../src/utilities/contactHref.js'

describe('telHref i mailtoHref', () => {
  it('amb valor, l\'enllaç net', () => {
    expect(telHref('+34 600 000 000')).toBe('tel:+34600000000')
    expect(mailtoHref(' a@b.c ')).toBe('mailto:a@b.c')
  })
  it.each(['', '  ', null, undefined])('amb %j, cap enllaç', (value) => {
    expect(telHref(value)).toBeUndefined()
    expect(mailtoHref(value)).toBeUndefined()
  })
})

// Un `<a>` sense `href`: el que quedaria si un lloc de crida pintés l'enllaç amb un `href` buit. El `(?=[\s>])` deixa
// fora les etiquetes que comencen per «a» (`<address>`, `<article>`), que el peu i el bloc `contact` sí que pinten.
const HREFLESS_ANCHOR = /<a(?=[\s>])(?![^>]*\shref=)[^>]*>/

// Uns ajustos acabats de migrar: sense telèfon ni correu.
const emptySettings = { socials: [], ui: { callUs: "Truqui'ns", copyright: 'Tots els drets reservats', writeUs: "Escrigui'ns" } }

const expectNoContactLinks = (html: string) => {
  expect(html).not.toContain('tel:')
  expect(html).not.toContain('mailto:')
  expect(html).not.toMatch(HREFLESS_ANCHOR)
}

describe('enllaços de contacte amb uns ajustos acabats de migrar (sense telèfon ni correu)', () => {
  it('el peu es pinta sense llançar i sense cap enllaç tel:, mailto: ni sense href', async () => {
    const data = {
      getCachedGlobal: () => async () => ({ columns: [], legalLinks: [], tagline: 'Peu' }),
      getFooterCredit: async () => false,
      getSiteSettings: async () => emptySettings,
    } as never
    const html = renderToStaticMarkup(await Footer({ data, locale: 'ca' }))
    expect(html).toContain('Peu')                                  // control positiu: el peu s'ha pintat
    expectNoContactLinks(html)
  })

  it('el bloc ctaBand es pinta sense llançar i sense cap enllaç tel:, mailto: ni sense href', () => {
    const html = renderToStaticMarkup(
      createElement(CtaBand, { blockType: 'ctaBand', heading: 'Banda', locale: 'ca', settings: emptySettings as never }),
    )
    expect(html).toContain('Banda')                                // control positiu
    expectNoContactLinks(html)
  })

  it('el bloc contact es pinta sense llançar i sense cap enllaç tel:, mailto: ni sense href', () => {
    const html = renderToStaticMarkup(
      // `form` sense poblar (un id): el bloc no pinta el formulari, que aquí no es prova.
      createElement(Contact, { blockType: 'contact', form: 1, heading: 'Contacte', locale: 'ca', settings: emptySettings as never }),
    )
    expect(html).toContain('Contacte')                             // control positiu
    expectNoContactLinks(html)
  })
})
