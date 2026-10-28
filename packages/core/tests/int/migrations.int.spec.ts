import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('./migrations (spec §3.3)', () => {
  it('l\'array porta les 10 congelades, en ordre, amb els noms d\'avui', async () => {
    const { migrations } = await import('@suburlabs/core/migrations')
    expect(migrations.slice(0, 10).map((m) => m.name)).toEqual([
      '20260922_092212_initial', '20260924_020209_site_settings_location', '20260925_080550_hero_film_loading',
      '20260925_221226_hero_beat_photo', '20260926_090554_c15t', '20260927_224712_site_settings_price_range',
      '20260927_233158_faq_block', '20260928_005048_jobs', '20261016_201855_plan_m_subscription_modules', '20261018_120000_next_cache',
    ])
  })
  it('dist/migrations no porta cap .d.ts (el motor llegiria cada .ts com a migració)', () => {
    expect(readdirSync(path.join(PKG, 'dist/migrations')).filter((f) => f.endsWith('.d.ts'))).toEqual([])
  })
  it('cada migració de src té el seu .json i l\'index les porta totes, en ordre (D25: una migració escrita fora de src, o oblidada a l\'index, salta aquí)', async () => {
    const dir = path.join(PKG, 'src/migrations')
    const ts = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort()
    expect(readdirSync(dir).filter((f) => f.endsWith('.json')).sort()).toEqual(ts.map((f) => f.replace(/\.ts$/, '.json')))
    const { migrations } = await import('@suburlabs/core/migrations')
    expect(migrations.map((m) => m.name)).toEqual(ts.map((f) => f.replace(/\.ts$/, '')))
  })
})
