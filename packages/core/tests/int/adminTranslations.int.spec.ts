import { redirectsTranslations } from '@payloadcms/plugin-redirects'
import config from '../fixtures/app/src/payload.config.js'
import { describe, expect, it } from 'vitest'

import { adminTranslations as createAdminTranslations } from '../../src/i18n/adminTranslations.js'
import { locales } from '../../src/i18n/config.js'

// Al paquet, les traduccions del panell porten el correu de suport per argument (Task 8).
const adminTranslations = createAdminTranslations('hola@subur.dev')

describe('traducciones propias del panel', () => {
  it('todas las claves existen en todos los idiomas del catálogo', () => {
    const keys = Object.keys(adminTranslations.es.subur).sort()
    for (const locale of locales) {
      expect(Object.keys(adminTranslations[locale].subur).sort()).toEqual(keys)
      for (const key of keys) {
        expect(adminTranslations[locale].subur[key as never], `${locale}.${key}`).toBeTruthy()
      }
    }
  })

  // Sin esto, un idioma del catálogo se podría contratar sin que el panel lo
  // hablase: el editor vería la interfaz en el idioma de reserva.
  it('el panel habla todos los idiomas del catálogo', async () => {
    expect(Object.keys((await config).i18n?.supportedLanguages ?? {}).sort()).toEqual(
      [...locales].sort(),
    )
  })

  it('la sobreescritura de «general:payloadSettings» existe en todos los idiomas y nunca menciona el motor', () => {
    for (const locale of locales) {
      expect(adminTranslations[locale].general.payloadSettings, locale).toBeTruthy()
      expect(adminTranslations[locale].general.payloadSettings, locale).not.toMatch(/payload/i)
    }
  })

  // El connector de redireccions no porta català: sense aquest bloc, un panell `ca` mostra les claus nues.
  it('les etiquetes catalanes del connector de redireccions cobreixen totes les claus i cap és anglesa', async () => {
    const en = redirectsTranslations.en['plugin-redirects'] as Record<string, string>
    const ownCa = adminTranslations.ca['plugin-redirects'] as Record<string, string>
    expect(Object.keys(ownCa).sort()).toEqual(Object.keys(en).sort())
    for (const [key, value] of Object.entries(ownCa)) {
      expect(value.trim(), key).toBeTruthy()
      expect(value, key).not.toBe(en[key])
    }
    // I arriben a la configuració construïda per sobre de les del connector (`deepMergeSimple` a `dist/index.js`).
    const merged = (await config).i18n?.translations as Record<string, Record<string, unknown>> | undefined
    expect(merged?.ca?.['plugin-redirects']).toEqual(ownCa)
  })
})
