// core/packages/core/tests/int/schema.int.spec.ts
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import { buildSuburConfig } from '../../src/config/index.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

const off = { ...siteConfig, optionalBlocks: { scrollHero: false, taskCatalog: false } }

describe('el motor valida optionalBlocks en desar (spec §3.3)', () => {
  it('control positiu: un bloc permès es desa', async () => {
    const payload = await getPayload({ config: buildSuburConfig(off, { baseDir: '/tmp' }) })
    const ok = await payload.create({ collection: 'pages', data: { layout: [{ blockType: 'note', text: 'x', title: 'x' }], slug: 'schema-ok', title: 'x' }, draft: false })
    expect(ok.id).toBeDefined()
  })
  it('un bloc present però no permès dona l\'error del motor al bloc, amb el seu slug (residu de C68; sonda S21)', async () => {
    const payload = await getPayload({ config: buildSuburConfig(off, { baseDir: '/tmp' }) })
    const valid = { blockType: 'taskCatalog' as const, groups: [{ icon: 'sofa' as const, tasks: [{ text: 'x' }], title: 'x' }] }
    await expect(payload.create({ collection: 'pages', data: { layout: [valid], slug: 'schema-probe', title: 'x' }, draft: false })).rejects.toMatchObject({
      // Sonda S21 (motor 3.89.0, Postgres de prova): errors = [{ path: 'layout.0.id', message: 'The block "taskCatalog" is not allowed.' }];
      // el missatge es tradueix a l'idioma del panell, el slug no. Un error d'un camp intern (layout.0.groups.0.icon) ja no passa.
      data: { errors: [expect.objectContaining({ message: expect.stringContaining('taskCatalog'), path: 'layout.0.id' })] },
    })
  })
})
