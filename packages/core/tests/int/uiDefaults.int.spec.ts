import { describe, expect, it } from 'vitest'

import { locales } from '../../src/i18n/config.js'
import { resolveUi } from '../../src/i18n/resolveUi.js'
import { uiDefaults, uiKeys } from '../../src/i18n/uiDefaults.js'
import { SiteSettings } from '../../src/SiteSettings/config.js'

const uiFieldNames = (): string[] => {
  const tabs = SiteSettings.fields.find((field) => field.type === 'tabs')
  if (!tabs || tabs.type !== 'tabs') throw new Error('faltan las pestañas de ajustes')
  for (const tab of tabs.tabs) {
    const group = tab.fields.find((field) => 'name' in field && field.name === 'ui')
    if (group && group.type === 'group') {
      return group.fields.flatMap((field) => ('name' in field && field.name ? [field.name] : []))
    }
  }
  throw new Error('falta el grupo ui')
}

const requiredUiFields = (): string[] => {
  const tabs = SiteSettings.fields.find((field) => field.type === 'tabs')
  if (!tabs || tabs.type !== 'tabs') return []
  return tabs.tabs.flatMap((tab) =>
    tab.fields.flatMap((field) =>
      'name' in field && field.name === 'ui' && field.type === 'group'
        ? field.fields.flatMap((item) =>
            'name' in item && 'required' in item && item.required ? [item.name] : [],
          )
        : [],
    ),
  )
}

describe('textos de interfaz por defecto', () => {
  it('cada clave tiene texto y etiqueta en todos los idiomas del catálogo', () => {
    for (const key of uiKeys) {
      for (const locale of locales) {
        expect(uiDefaults[key].text[locale], `falta ui.${key} en ${locale}`).toBeTruthy()
        expect(uiDefaults[key].label[locale], `falta la etiqueta de ui.${key} en ${locale}`).toBeTruthy()
      }
    }
  })

  it('los campos del panel son exactamente las claves por defecto, y ninguno es obligatorio', () => {
    expect(uiFieldNames().sort()).toEqual([...uiKeys].sort())
    expect(requiredUiFields()).toEqual([])
  })
})

describe('resolveUi', () => {
  it('usa el texto del cliente cuando existe', () => {
    expect(resolveUi({ callUs: 'Llame ahora' }, 'es').callUs).toBe('Llame ahora')
  })

  it('cae al texto del núcleo en el idioma pedido, no en el idioma por defecto', () => {
    expect(resolveUi({}, 'en').callUs).toBe('Call us')
    expect(resolveUi({ callUs: '   ' }, 'ca').callUs).toBe("Truqui'ns")
    expect(resolveUi(null, 'es').notFoundTitle).toBe('Página no encontrada')
  })
})
