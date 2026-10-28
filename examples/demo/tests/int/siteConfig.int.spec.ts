import { describe, expect, it } from 'vitest'

import { catalogLocales } from '../../../../packages/core/src/i18n/catalog.js'
import { siteConfig } from '../../src/site/site.config'

describe('siteConfig: identitat del client', () => {
  it('id: minúscules, xifres i _, com create-client-db.sh', () => {
    expect(siteConfig.id).toMatch(/^[a-z0-9_]+$/)
  })
  it('clientLocale és un idioma del catàleg', () => {
    expect(catalogLocales).toContain(siteConfig.clientLocale)
  })
  it('clientLocale és ca o es', () => {
    // fins que hi hagi plantilla en anglès
    expect(['ca', 'es']).toContain(siteConfig.clientLocale)
  })
})
