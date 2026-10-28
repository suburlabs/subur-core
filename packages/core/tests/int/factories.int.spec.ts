import { describe, expect, it } from 'vitest'

import * as app from '../../src/app/index.js'
import config from '../fixtures/app/src/payload.config.js'

describe('fàbriques de ./app (spec §3.1)', () => {
  it('exporta les fàbriques públiques, createSiteData i createSuburAssetsRoute', () => {
    expect(Object.keys(app).sort()).toEqual([
      'createConsentRoute', 'createLlmsRoute', 'createLocaleLayout', 'createLocalePage', 'createNotFound',
      'createPreviewRoutes', 'createSiteData', 'createSitemapRoutes', 'createSlugPage', 'createSuburAssetsRoute',
    ])
  })
  it('el viewport del layout porta el themeColor del client (spec §3.4)', () => {
    const { viewport } = app.createLocaleLayout({ config, fontVariables: '' })
    expect(viewport.themeColor).toEqual([
      { color: '#f6f6f4', media: '(prefers-color-scheme: light)' },
      { color: '#101418', media: '(prefers-color-scheme: dark)' },
    ])
  })
})
