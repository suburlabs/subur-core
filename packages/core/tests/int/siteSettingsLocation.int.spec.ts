import config from '../fixtures/app/src/payload.config.js'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { ensureSiteSettings } from '../helpers/ensureSiteSettings.js'

/** Cap prova no ha de disparar la revalidació de les rutes. */
const context = { disableRevalidate: true }

/**
 * El grup `location` alimenta les dades estructurades (spec §20.3): cap camp
 * és obligatori (una web pot no tenir seu física), `addressCountry` és un
 * codi ISO de dues lletres i `areaServed` es tradueix.
 */
describe('site-settings.location', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
    // La validació és del document sencer per idioma: sense els quatre camps
    // obligatoris de «Contacte» cap `updateGlobal` parcial no passaria, i la
    // prova del país rebutjat passaria pel motiu equivocat.
    await ensureSiteSettings(payload)
  })

  it('accepta el grup complet i el retorna', async () => {
    const saved = await payload.updateGlobal({
      context,
      data: {
        googleBusinessProfile: 'https://maps.app.goo.gl/ejemplo',
        location: {
          addressCountry: 'ES',
          addressLocality: 'Vila Exemple',
          addressRegion: 'Exemple',
          areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }],
          geo: { latitude: 40.1234, longitude: 0.5678 },
          postalCode: '00000',
          streetAddress: 'Calle Ejemplo 1, local 1',
        },
      },
      locale: 'es',
      slug: 'site-settings',
    })
    expect(saved.location?.addressLocality).toBe('Vila Exemple')
    expect(saved.location?.geo?.latitude).toBeCloseTo(40.1234)
    expect(saved.location?.areaServed?.map((a) => a.name)).toEqual(['Vila Exemple', 'Poble Exemple'])
    expect(saved.googleBusinessProfile).toBe('https://maps.app.goo.gl/ejemplo')
  })

  it('rebutja un país que no sigui un codi de dues lletres', async () => {
    const rejection = await payload
      .updateGlobal({
        context,
        data: { location: { addressCountry: 'España' } },
        locale: 'es',
        slug: 'site-settings',
      })
      .then(
        () => undefined,
        (error: unknown) => error as { data?: { errors?: { message: string; path: string }[] } },
      )

    // El missatge exacte i un sol error importen: un rebuig per qualsevol
    // altre motiu (un camp obligatori buit, per exemple) faria passar la
    // prova sense provar res.
    expect(rejection?.data?.errors).toEqual([
      expect.objectContaining({
        message: 'Código ISO de dos letras en mayúsculas (ES).',
        path: 'location.addressCountry',
      }),
    ])
  })

  it('areaServed és localitzat: el català no arrossega el castellà', async () => {
    await payload.updateGlobal({
      context,
      data: { location: { areaServed: [{ name: 'Vila Exemple (ca)' }] } },
      locale: 'ca',
      slug: 'site-settings',
    })
    const es = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'es',
      slug: 'site-settings',
    })
    const ca = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'ca',
      slug: 'site-settings',
    })
    expect(es.location?.areaServed?.[0]?.name).toBe('Vila Exemple')
    expect(ca.location?.areaServed?.[0]?.name).toBe('Vila Exemple (ca)')
    // Els camps no localitzats del grup sobreviuen a una escriptura parcial
    // en un altre idioma (`updateGlobal` fusiona; no esborra el que no ve).
    expect(ca.location?.addressLocality).toBe('Vila Exemple')
    expect(ca.location?.streetAddress).toBe('Calle Ejemplo 1, local 1')
  })

  it('escriptura parcial en anglès amb fallbackLocale:false no arrossega les files castellanes ni en crea de noves', async () => {
    await expect(
      payload.updateGlobal({
        context,
        data: { ui: { callUs: 'Call now' } },
        fallbackLocale: false,
        locale: 'en',
        slug: 'site-settings',
      }),
    ).resolves.toBeTruthy()

    const es = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'es',
      slug: 'site-settings',
    })
    const en = await payload.findGlobal({
      depth: 0,
      fallbackLocale: false,
      locale: 'en',
      slug: 'site-settings',
    })
    // Les files castellanes de la primera prova sobreviuen intactes...
    expect(es.location?.areaServed?.map((a) => a.name)).toEqual(['Vila Exemple', 'Poble Exemple'])
    // ...i l'anglès no n'hereta cap: cap fila nova amb la `id` compartida.
    expect(en.location?.areaServed).toBeFalsy()
  })

  it('la mateixa escriptura sense fallbackLocale:false rebutja: és el límit del motor, no el nostre', async () => {
    const write = payload.updateGlobal({
      context,
      data: { ui: { callUs: 'Call now again' } },
      locale: 'en',
      slug: 'site-settings',
    })
    await expect(write).rejects.toThrow()
    // El missatge («El siguiente campo es inválido: id») és enganyós — apunta
    // a un camp que ningú ha tocat —, però confirma que és exactament
    // aquest error, i no un de qualsevol altre tipus.
    await expect(write).rejects.toThrow(/id/)
  })
})
