import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { seedOrderOf } from '../../src/site/index.js'
import { collectFacts, parseFacts } from '../../src/subur/facts.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

/**
 * Al paquet, els fets del client de prova (Task 16): el contracte és el de `tests/fixtures/subur/` (maxLanguages 3) i
 * els idiomes del seed, `seedOrderOf(siteConfig)` (Task 4). El protocol (`subur facts --json`) el prova
 * `bin.int.spec.ts`; els lectors dels fets (`readClientFacts`, `lastErrorLine`) són de la capa subur-ops i es queden a
 * l'arrel.
 */
const input = () => ({
  backupVersion: null,
  contract: { maxLanguages: 3 },
  packageVersion: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
  siteConfig,
})

describe('subur:facts', () => {
  it('collectFacts: els fets del client de prova', () => {
    const f = collectFacts(input())
    expect(f).toMatchObject({ schema: 1, id: 'fixture', domain: 'fixture.example', url: 'https://fixture.example', name: 'Web de Prova', locale: 'ca', defaultLocale: 'es', themeColor: { dark: '#101418', light: '#f6f6f4' }, backupVersion: null })
    expect(f.activeLocales).toEqual(['es', 'ca', 'en'])
    expect(f.activeLocales).toEqual(seedOrderOf(siteConfig).slice(0, 3))
    expect(f.posters).toEqual(['/site/hero/poster-1.webp', '/site/hero/poster-2.webp', '/site/hero/poster-3.webp', '/site/hero/poster-4.webp'])
    expect(f.coreVersion).toBe(input().packageVersion)
  })
  it('sense contracte, activeLocales és només el primer del seed', () => {
    expect(collectFacts({ ...input(), contract: null }).activeLocales).toEqual(['es'])
  })
  it('collectFacts rebutja un id o un domini invàlids', () => {
    expect(() => collectFacts({ ...input(), siteConfig: { ...siteConfig, id: 'Fixture' } })).toThrow(/^facts: id invàlid/)
    expect(() => collectFacts({ ...input(), siteConfig: { ...siteConfig, domain: 'https://x.y' } })).toThrow(/^facts: domain invàlid/)
  })
  it('parseFacts: esquema desconegut i forma invàlida, amb el camp', () => {
    expect(() => parseFacts(JSON.stringify({ schema: 2 }))).toThrow(/esquema 2/)
    expect(() => parseFacts(JSON.stringify({ ...collectFacts(input()), url: 'fixture.example' }))).toThrow(/url/)
    // L'url és la del domini, ni una altra ni amb camí.
    for (const url of ['https://altre.example', 'https://fixture.example/', 'https://fixture.example/es', 'http://fixture.example']) {
      expect(() => parseFacts(JSON.stringify({ ...collectFacts(input()), url })), url).toThrow('facts: url ha de ser https://<domain>')
    }
    expect(() => parseFacts(JSON.stringify({ ...collectFacts(input()), posters: 'x' }))).toThrow(/posters/)
    const bad = (o: object) => () => parseFacts(JSON.stringify({ ...collectFacts(input()), ...o }))
    expect(bad({ locale: 'en' })).toThrow(/locale/)
    expect(bad({ defaultLocale: 5 })).toThrow(/defaultLocale/)
    expect(bad({ activeLocales: 'es' })).toThrow(/activeLocales/)
    expect(bad({ activeLocales: ['es', 'fr'] })).toThrow(/activeLocales/)
    expect(bad({ backupVersion: 3 })).toThrow(/backupVersion/)
    expect(parseFacts(JSON.stringify(collectFacts(input())))).toEqual(collectFacts(input()))
  })
  it('parseFacts accepta themeColor null (l\'script d\'E3a) o { light, dark } hex (el paquet), i rebutja la resta', () => {
    const base = collectFacts(input())
    // Al paquet, els fets porten el themeColor del client; el null és el de l'script local d'E3a.
    expect(parseFacts(JSON.stringify(base)).themeColor).toEqual({ dark: '#101418', light: '#f6f6f4' })
    expect(parseFacts(JSON.stringify({ ...base, themeColor: null })).themeColor).toBeNull()
    expect(parseFacts(JSON.stringify({ ...base, themeColor: { dark: '#101418', light: '#F6F6F4' } })).themeColor).toEqual({ dark: '#101418', light: '#F6F6F4' })
    expect(() => parseFacts(JSON.stringify({ ...base, themeColor: { light: 'red' } }))).toThrow(/themeColor/)
    expect(() => parseFacts(JSON.stringify({ ...base, themeColor: '#fff' }))).toThrow(/themeColor/)
    expect(() => parseFacts(JSON.stringify({ ...base, themeColor: { light: 'red', dark: '#101418' } }))).toThrow(/themeColor/)
  })
})
