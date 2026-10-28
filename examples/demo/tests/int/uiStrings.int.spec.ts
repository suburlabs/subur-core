import { describe, expect, it } from 'vitest'

// Intern del paquet, pel camí de font del workspace (regla de les proves de la demo, Task 16; D56)
import { SiteSettings } from '../../../../packages/core/src/SiteSettings/config.js'
import { content as demoContent } from '../../src/site/seed/content'

// A la demo, el contingut de cada idioma és `content.byLocale` (el format de `runSeed`).
const seedContent = demoContent.byLocale

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

const themeKeys = ['themeLabel', 'themeLight', 'themeDark', 'themeSystem'] as const

describe('textos de interfaz del tema', () => {
  it('existen como campos editables', () => {
    expect(uiFieldNames()).toEqual(expect.arrayContaining([...themeKeys]))
  })

  it.each(['es', 'ca', 'en'] as const)('el seed no sobreescribe los textos por defecto en %s', (locale) => {
    const content = seedContent[locale]
    expect(content).toBeDefined()
    const build = content!.build({ formId: 1, media: {}, pages: {} } as never)
    expect(build.siteSettings.ui).toBeUndefined()
  })
})
