import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { hasModuleIn, readSuburContract, SuburContractError } from '../../src/subur/contract.js'
import { MODULE_ADVANCED_SEO, MODULE_AI_VISIBILITY } from '../../src/subur/modules.js'

const FIXTURE = path.resolve('tests/fixtures/subur')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true }) })

/** Un repositori temporal amb la fixture a `.subur/`, amb `patch` aplicat a un dels fitxers. */
function repo(patch?: { file: 'contract' | 'modules' | 'operations'; change: (doc: Record<string, unknown>) => Record<string, unknown> | string }): string {
  const root = mkdtempSync(path.join(tmpdir(), 'subur-'))
  roots.push(root)
  cpSync(FIXTURE, path.join(root, '.subur'), { recursive: true })
  if (patch) {
    const file = path.join(root, '.subur', `${patch.file}.json`)
    const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const next = patch.change(doc)
    writeFileSync(file, typeof next === 'string' ? next : `${JSON.stringify(next, null, 2)}\n`)
  }
  return root
}

describe('readSuburContract', () => {
  it('llegeix la fixture del client de prova', () => {
    const c = readSuburContract(repo(), 'fixture')
    expect(c.plan).toBe('business')
    expect(c.contract.status).toBe('actiu')
    expect(c.contract.current.revision).toBe('2026-09-29.1')
    expect(c.moduleIds).toEqual(['blog', 'advanced-seo', 'ai-visibility', 'priority-support', 'internacional'])
    expect(c.maxLanguages).toBe(3)
    expect(c.operations.backup).toEqual({ copies: 30, frequency: 'daily' })
    expect(c.operations).toMatchObject({ handoffDays: 10, retentionDays: 30, seoReport: 'quarterly' })
    expect(hasModuleIn(c, MODULE_AI_VISIBILITY)).toBe(true)
    expect(hasModuleIn(c, MODULE_ADVANCED_SEO)).toBe(true)
    expect(hasModuleIn(c, 'reserves')).toBe(false)
  })

  it('sense .subur/ diu com generar-lo', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'subur-'))
    roots.push(root)
    expect(() => readSuburContract(root, 'fixture')).toThrow(SuburContractError)
    expect(() => readSuburContract(root, 'fixture')).toThrow(/Falta \.subur\/: genera'l des de subur-business/)
  })

  it('sense un dels tres fitxers, el mateix missatge amb el fitxer', () => {
    const root = repo()
    rmSync(path.join(root, '.subur/operations.json'))
    expect(() => readSuburContract(root, 'fixture')).toThrow(/operations\.json/)
  })

  it('rebutja un esquema que no és 1, a qualsevol fitxer', () => {
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, schema: 2 }), file: 'modules' }), 'fixture')).toThrow(/modules\.json: esquema 2 desconegut \(aquest repositori coneix l'1\)/)
  })

  it("rebutja un .subur/ d'un altre client", () => {
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, slug: 'altre' }), file: 'contract' }), 'fixture')).toThrow(/\.subur\/ és del client «altre», no de «fixture»/)
  })

  it('rebutja un JSON mal format amb el camí del fitxer', () => {
    expect(() => readSuburContract(repo({ change: () => '{', file: 'operations' }), 'fixture')).toThrow(/operations\.json: no és JSON/)
  })

  it('rebutja formes invàlides amb el camí del camp', () => {
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, backup: { copies: 0, frequency: 'daily' } }), file: 'operations' }), 'fixture')).toThrow(/operations\.json: backup\.copies ha de ser un enter ≥ 1/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, backup: { copies: 3, frequency: 'weekly' } }), file: 'operations' }), 'fixture')).toThrow(/operations\.json: backup\.frequency ha de ser daily o monthly/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, retentionDays: -1 }), file: 'operations' }), 'fixture')).toThrow(/operations\.json: retentionDays ha de ser un enter ≥ 0/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, seoReport: 'yearly' }), file: 'operations' }), 'fixture')).toThrow(/operations\.json: seoReport ha de ser audit o quarterly/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, current: { ...(d.current as object), plan: 'pro' } }), file: 'contract' }), 'fixture')).toThrow(/contract\.json: current\.plan ha de ser business o starter/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, status: 'pausa' }), file: 'contract' }), 'fixture')).toThrow(/contract\.json: status ha de ser actiu, hibernació o baixa/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, history: {} }), file: 'contract' }), 'fixture')).toThrow(/contract\.json: history ha de ser una llista/)
    expect(() => readSuburContract(repo({ change: ({ current: _current, ...d }) => d, file: 'contract' }), 'fixture')).toThrow(/contract\.json: current ha de ser un objecte/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, current: { ...(d.current as object), effectiveFrom: '29/09/2026' } }), file: 'contract' }), 'fixture')).toThrow(
      /contract\.json: current\.effectiveFrom ha de ser una data AAAA-MM-DD/,
    )
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, limits: { ...(d.limits as object), languages: 0 } }), file: 'modules' }), 'fixture')).toThrow(/modules\.json: limits\.languages ha de ser un enter ≥ 1/)
    expect(() => readSuburContract(repo({ change: (d) => ({ ...d, included: [{ id: 'blog' }] }), file: 'modules' }), 'fixture')).toThrow(/modules\.json: included\[0\]\.origin ha de ser plan, addon o hores/)
  })

  it('no llegeix res fora dels tres fitxers (el snapshot pot faltar)', () => {
    const root = repo()
    rmSync(path.join(root, '.subur/snapshots'), { force: true, recursive: true })
    expect(readSuburContract(root, 'fixture').plan).toBe('business')
  })
})
