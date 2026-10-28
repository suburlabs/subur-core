// core/packages/core/tests/int/renderBlocksOn.int.spec.ts
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('subur-site-config', async () => {
  const { siteConfig } = await import('../fixtures/app/src/site/site.config.js')
  return { siteConfig: { ...siteConfig, optionalBlocks: { scrollHero: true, taskCatalog: true } } }
})

import { RenderBlocks } from '../../src/blocks/RenderBlocks.js'

describe('amb el bloc permès, es pinta', () => {
  it('pinta la nota i el catàleg de tasques', async () => {
    const element = await RenderBlocks({
      blocks: [
        { blockType: 'note', id: 'a', text: 'NOTA-VISIBLE', title: 'Nota' },
        { blockType: 'taskCatalog', groups: [{ icon: 'sofa', tasks: [{ text: 'TASCA-VISIBLE' }], title: 'Grup' }], id: 'b' },
      ] as never,
      locale: 'es',
      settings: { ui: {} } as never,
    })
    const html = renderToStaticMarkup(element)
    expect(html).toContain('NOTA-VISIBLE')
    expect(html).toContain('TASCA-VISIBLE')
  })
})
