import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { assertGateDatabase, gatePlan, redactLine } from '../../src/gate/index.js'
import type { Facts } from '../../src/subur/facts.js'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const facts = (over: Partial<Facts> = {}): Facts => ({
  activeLocales: ['ca', 'es', 'en'], backupVersion: null, coreVersion: '0.0.0', defaultLocale: 'ca', domain: 'demo.example', id: 'demo',
  locale: 'ca', name: 'Reformes Exemple', posters: ['/site/hero/poster-1.webp'], schema: 1, themeColor: { dark: '#121a16', light: '#f4f3ef' },
  url: 'https://demo.example', ...over,
})

describe('porta parametritzada pels fets (spec §7)', () => {
  it('idiomes actius, el primer com a camí principal, i el primer pòster del client', () => {
    const plan = gatePlan(facts(), '/app')
    expect(plan).toEqual({
      imagePath: `/_next/image?url=${encodeURIComponent('/site/hero/poster-1.webp')}&w=640&q=100`,
      locales: ['ca', 'es', 'en'], poster: '/site/hero/poster-1.webp', posterFile: '/app/public/site/hero/poster-1.webp', primary: 'ca', primaryPath: '/ca',
    })
  })
  it('un client amb un sol idioma (ca) no toca /es', () => {
    const plan = gatePlan(facts({ activeLocales: ['ca'] }), '/app')
    expect(plan.locales).toEqual(['ca'])
    expect(plan.primaryPath).toBe('/ca')
  })
  it('un client sense idiomes actius no pot passar la porta: error amb el camp', () => expect(() => gatePlan(facts({ activeLocales: [] }), '/app')).toThrow(/activeLocales/))
  it('un client sense pòsters no pot passar la porta: error amb el camp', () => {
    expect(() => gatePlan(facts({ posters: [] }), '/app')).toThrow(/posters/)
  })
  it('cap /es, locale=es, \'es\' ni poster-1 fix al cos de la porta (cometes simples, dobles, plantilles i regex; D52)', () => {
    // Sonda S16: a scripts/ci/cacheGate.ts d'avui troba 17 llocs (línies 30, 31, 408–517), entre ells href="/es/${newSlug}" i /href="(\/es\/…)"/
    expect(readFileSync(path.join(SRC, 'gate/cacheGate.ts'), 'utf8').match(/\/es\b|=es\b|'es'|"es"|\\\/es\\\/|poster-1/g)).toBeNull()
  })
  it('el pla d\'un client només en ca no porta cap /es', () => {
    expect(JSON.stringify(gatePlan(facts({ activeLocales: ['ca'] }), '/app'))).not.toMatch(/\/es\b/)
  })
  describe('assertGateDatabase: la guarda de la base abans de cap escriptura', () => {
    afterEach(() => vi.unstubAllEnvs())
    const url = (name: string, host = '127.0.0.1:5432') => `postgres://u:p@${host}/${name}`
    it('subur_gate i subur_gate_<nom> passen; cap altra base, ni la de la demo', () => {
      vi.stubEnv('CI', '')
      expect(() => assertGateDatabase(url('subur_gate'))).not.toThrow()
      expect(() => assertGateDatabase(url('subur_gate_x'))).not.toThrow()
      expect(() => assertGateDatabase(url('subur_demo_dev'))).toThrow(/base no permesa/)
      expect(() => assertGateDatabase(url('subur_gatex'))).toThrow(/base no permesa/)
    })
    it('subur només amb CI=true i a 127.0.0.1:5432 (el servei del job)', () => {
      vi.stubEnv('CI', '')
      expect(() => assertGateDatabase(url('subur'))).toThrow(/base no permesa/)
      vi.stubEnv('CI', 'true')
      expect(() => assertGateDatabase(url('subur'))).not.toThrow()
      expect(() => assertGateDatabase(url('subur', '127.0.0.1:5999'))).toThrow(/base no permesa/)
      expect(() => assertGateDatabase(url('subur', 'db.example:5432'))).toThrow(/base no permesa/)
    })
  })
  it('redactLine: cap valor de secret ni contrasenya de connexió', () => {
    expect(redactLine('SUBUR_SECRET=abc')).toBe('SUBUR_SECRET=<redactat>')
    expect(redactLine('postgres://u:pw@h/db')).toBe('postgres://u:<redactat>@h/db')
    expect(redactLine('Authorization: Bearer abcdefghijklmnopqrstu')).not.toContain('abcdefghijklmnopqrstu')
  })
})
