// core/packages/core/tests/int/footerCredit.int.spec.ts
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { suburCredit } from '../../src/components/SuburCredit/credit.js'
import { seedSubscription } from '../../src/seed/subscription.js'
import { readSuburContract } from '../../src/subur/contract.js'
import config from '../fixtures/app/src/payload.config.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FIX = path.join(PKG, 'tests/fixtures')

describe('crèdit al peu (spec §0.5)', () => {
  let editor: { id: number | string }
  beforeAll(async () => {
    const payload = await getPayload({ config })
    // El camp és `role` (select: superadmin | admin; src/collections/Users/index.ts), no `roles` (D58).
    editor = await payload.create({ collection: 'users', data: { email: 'editor@fixture.example', password: 'x-x-x-x-x-x', role: 'admin' } as never })
  })
  it('els textos de l\'spec, enllaçats a subur.dev', () => {
    expect(suburCredit).toEqual({
      ca: { href: 'https://subur.dev', text: 'Web feta per Subur' },
      en: { href: 'https://subur.dev', text: 'Website by Subur' },
      es: { href: 'https://subur.dev', text: 'Web hecha por Subur' },
    })
  })
  it('la columna existeix, per defecte és fals, i un superadministrador l\'escriu', async () => {
    const payload = await getPayload({ config })
    const { rows } = await (payload.db as unknown as { pool: { query: (t: string) => Promise<{ rows: Array<{ column_default: string }> }> } }).pool.query(
      "select column_default from information_schema.columns where table_name = 'subscription' and column_name = 'footer_credit'",
    )
    expect(rows).toEqual([{ column_default: 'false' }])   // la prova del per defecte; findGlobal dependria de l'ordre dels fitxers sobre la base compartida (nit de la ronda 3)
    // La columna surt de la migració, no de la configuració: el `defaultValue` del camp (el que el motor posa en crear el
    // document) es comprova a part, perquè un `true` a la configuració sense migració nova no el veuria la consulta d'amunt.
    const field = payload.config.globals.find((g) => g.slug === 'subscription')!.fields.find((f) => 'name' in f && f.name === 'footerCredit')
    expect(field).toMatchObject({ defaultValue: false, type: 'checkbox' })
    await payload.updateGlobal({ data: { footerCredit: true }, slug: 'subscription' })
    expect((await payload.findGlobal({ slug: 'subscription' })).footerCredit).toBe(true)
  })
  it('un administrador que no és superadministrador no el pot canviar (403); un superadministrador sí', async () => {
    const payload = await getPayload({ config })
    await expect(payload.updateGlobal({ data: { footerCredit: false }, overrideAccess: false, slug: 'subscription', user: editor as never })).rejects.toMatchObject({ status: 403 })
    const supers = await payload.find({ collection: 'users', limit: 1, where: { role: { equals: 'superadmin' } } })
    const superadmin = supers.docs[0] ?? (await payload.create({ collection: 'users', data: { email: 'super@fixture.example', password: 'x-x-x-x-x-x', role: 'superadmin' } as never }))
    await expect(payload.updateGlobal({ data: { footerCredit: true }, overrideAccess: false, slug: 'subscription', user: superadmin as never })).resolves.toMatchObject({ footerCredit: true })
  })
  it('readSuburContract: absent → fals, true → cert; seedSubscription el passa', () => {
    expect(readSuburContract(path.join(FIX, 'subur-root'), 'fixture').footerCredit).toBe(false)
    expect(readSuburContract(path.join(FIX, 'subur-credit-root'), 'fixture').footerCredit).toBe(true)
    expect(seedSubscription({ repoRoot: path.join(FIX, 'subur-credit-root'), siteConfig })?.footerCredit).toBe(true)
    expect(() => readSuburContract(path.join(FIX, 'subur-bad-credit-root'), 'fixture')).toThrow(/footerCredit/)
  })
  it('la migració és additiva: l\'up no porta cap DROP i la columna té valor per defecte (spec §3.3)', () => {
    const file = readdirSync(path.join(PKG, 'src/migrations')).find((f) => f.endsWith('_footer_credit.ts'))!
    const text = readFileSync(path.join(PKG, 'src/migrations', file), 'utf8')
    const up = text.slice(text.indexOf('export async function up'), text.indexOf('export async function down'))
    expect(up).not.toMatch(/\bDROP\b/)
    expect(up).toMatch(/ADD COLUMN[^;]*footer_credit[^;]*DEFAULT false/i)
  })
})
