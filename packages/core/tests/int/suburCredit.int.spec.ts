import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { Footer } from '../../src/Footer/config.js'
import { locales } from '../../src/i18n/config.js'
import { SiteSettings } from '../../src/SiteSettings/config.js'
import { suburCredit } from '../../src/components/SuburCredit/credit.js'

const fieldNames = (fields: Field[]): string[] =>
  fields.flatMap((field) => {
    const own = 'name' in field && field.name ? [field.name] : []
    const nested = 'fields' in field && Array.isArray(field.fields) ? fieldNames(field.fields) : []
    const tabs = field.type === 'tabs' ? field.tabs.flatMap((tab) => fieldNames(tab.fields)) : []
    return [...own, ...nested, ...tabs]
  })

describe('crédito de plataforma', () => {
  it.each(locales)('tiene texto y enlace en %s', (locale) => {
    expect(suburCredit[locale].text).toMatch(/Subur/)
    expect(suburCredit[locale].href).toBe('https://subur.dev')
  })

  it('no es editable desde el panel', () => {
    const names = [...fieldNames(Footer.fields), ...fieldNames(SiteSettings.fields)]
    for (const name of names) {
      expect(name).not.toMatch(/subur|credit/i)
    }
  })
})
