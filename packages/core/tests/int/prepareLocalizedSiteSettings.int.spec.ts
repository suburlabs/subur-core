import { describe, expect, it } from 'vitest'

import { uiKeys } from '../../src/i18n/uiDefaults.js'
import { prepareLocalizedSiteSettings } from '../../src/seed/prepareLocalizedSiteSettings.js'

// Un document de site-settings tal com el llegiria `findGlobal` en l'idioma
// per defecte (es): cada clau de `ui` ja porta text castellà d'una sembra
// anterior.
const currentEs = {
  address: 'Calle Ejemplo 1, local 1',
  email: 'hola@fixture.example',
  hours: 'Lunes a viernes, de 9 h a 19 h',
  phone: '+34 600 000 000',
  socials: [{ platform: 'whatsapp', url: 'https://wa.me/34600000000' }],
  ui: Object.fromEntries(uiKeys.map((key) => [key, `castellano ${key}`])),
}

describe('prepareLocalizedSiteSettings', () => {
  it('cada clave de ui queda a null cuando la traducción no sobreescribe ninguna (reproducibilidad de la sembra)', () => {
    const localizedCa = { address: 'Carrer Exemple 1, local 1' } as never

    const result = prepareLocalizedSiteSettings(currentEs, localizedCa)

    for (const key of uiKeys) {
      expect(result.ui as Record<string, unknown>).toHaveProperty(key, null)
    }
  })

  it('no arrastra el texto castellano de "current" a ninguna clave de ui', () => {
    const localizedCa = {} as never

    const result = prepareLocalizedSiteSettings(currentEs, localizedCa)
    const ui = result.ui as Record<string, unknown>

    for (const key of uiKeys) {
      expect(ui[key]).not.toBe(`castellano ${key}`)
    }
  })

  it('conserva la sobreescritura del cliente cuando la traducción sí trae ui', () => {
    const localizedCa = { ui: { callUs: "Truqui'ns" } } as never

    const result = prepareLocalizedSiteSettings(currentEs, localizedCa)
    const ui = result.ui as Record<string, unknown>

    expect(ui.callUs).toBe("Truqui'ns")
    expect(ui.writeUs).toBeNull()
  })

  it('quita el id de las filas de location.areaServed: es la única lista localizada y su id es la clave primaria compartida entre idiomas', () => {
    const currentWithLocation = {
      ...currentEs,
      location: {
        addressLocality: 'Vila Exemple',
        areaServed: [
          { id: '68d2f1a0c3b4d5e6f7a8b9c0', name: 'Vila Exemple' },
          { id: '68d2f1a0c3b4d5e6f7a8b9c1', name: 'Poble Exemple' },
        ],
        streetAddress: 'Calle Ejemplo 1, local 1',
      },
    }
    const localizedCa = {
      location: { areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }] },
    } as never

    const result = prepareLocalizedSiteSettings(currentWithLocation, localizedCa)
    const location = result.location as Record<string, unknown>

    expect(location.areaServed).toEqual([{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }])
    // Los campos no localizados del grupo se siguen heredando del castellano.
    expect(location.streetAddress).toBe('Calle Ejemplo 1, local 1')
    expect(location.addressLocality).toBe('Vila Exemple')
  })

  it('mantiene el resto de campos fusionados como siempre (dirección, teléfono...)', () => {
    const localizedCa = { address: 'Carrer Exemple 1, local 1' } as never

    const result = prepareLocalizedSiteSettings(currentEs, localizedCa)

    expect(result.address).toBe('Carrer Exemple 1, local 1')
    expect(result.phone).toBe('+34 600 000 000')
  })
})
