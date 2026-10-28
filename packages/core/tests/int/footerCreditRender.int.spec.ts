// core/packages/core/tests/int/footerCreditRender.int.spec.ts — el peu pinta el crèdit només si el global el demana (D58)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// L'enllaç de preferències de galetes (c15t) exigeix el seu proveïdor: fora d'ell, «useConsentManager must be used within a
// ConsentManagerProvider» i el peu no es pinta (E17; sonda S32: amb aquest mock el peu es pinta i el text del peu hi és).
vi.mock('../../src/components/CookiePreferencesTrigger/index.js', () => ({ CookiePreferencesTrigger: () => null }))

import { Footer } from '../../src/Footer/Component.js'

const data = (credit: boolean) =>
  ({
    getCachedGlobal: () => async () => ({ columns: [], legalLinks: [], tagline: 'Peu' }),
    getFooterCredit: async () => credit,
    getSiteSettings: async () => ({ email: 'hola@fixture.example', phone: '+34 600 000 000', socials: [], ui: { copyright: 'Tots els drets reservats' } }),
  }) as never

describe('crèdit al peu segons subscription.footerCredit (spec §0.5)', () => {
  it('amb fals, cap enllaç a subur.dev', async () => {
    const html = renderToStaticMarkup(await Footer({ data: data(false), locale: 'ca' }))
    expect(html).toContain('Peu')                                  // control positiu: el peu s'ha pintat
    expect(html).not.toContain('href="https://subur.dev"')
  })
  it('amb cert, el text de l\'idioma i l\'enllaç', async () => {
    const html = renderToStaticMarkup(await Footer({ data: data(true), locale: 'ca' }))
    expect(html).toContain('Peu')
    expect(html).toContain('href="https://subur.dev"')
    expect(html).toContain('Web feta per')
  })
})
