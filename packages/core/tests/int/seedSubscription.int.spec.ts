import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { seedSubscription } from '../../src/seed/subscription.js'
import { siteConfig } from '../fixtures/app/src/site/site.config.js'

const FIXTURE = path.resolve('tests/fixtures/subur')
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

const tempRepo = (withSubur: boolean): string => {
  const root = mkdtempSync(path.join(tmpdir(), 'subur-seed-'))
  roots.push(root)
  if (withSubur) cpSync(FIXTURE, path.join(root, '.subur'), { recursive: true })
  return root
}

describe('seedSubscription', () => {
  it('amb .subur/, pla, mòduls i límit surten del contracte', () => {
    const log = vi.fn()
    // Al paquet, també el crèdit al peu surt del contracte (Task 14): la fixture diu `footerCredit: false`.
    expect(seedSubscription({ log, repoRoot: tempRepo(true), siteConfig })).toEqual({
      activeLocales: ['es', 'ca', 'en'],
      footerCredit: false,
      maxLanguages: 3,
      modules: ['blog', 'advanced-seo', 'ai-visibility', 'priority-support', 'internacional'],
      plan: 'business',
    })
    expect(log).not.toHaveBeenCalled()
  })

  it('amb un contracte de menys idiomes, els actius es retallen al màxim (el per defecte primer)', () => {
    const root = tempRepo(true)
    const file = path.join(root, '.subur/modules.json')
    const modules = JSON.parse(readFileSync(file, 'utf8')) as { limits: { languages: number } }
    modules.limits.languages = 1
    writeFileSync(file, `${JSON.stringify(modules, null, 2)}\n`)
    const seeded = seedSubscription({ log: vi.fn(), repoRoot: root, siteConfig })
    expect(seeded?.maxLanguages).toBe(1)
    expect(seeded?.activeLocales).toEqual(['es'])
  })

  it('sense .subur/ (la imatge seed de producció), torna null i ho diu: el global no es toca', () => {
    const log = vi.fn()
    expect(seedSubscription({ log, repoRoot: tempRepo(false), siteConfig })).toBeNull()
    expect(log).toHaveBeenCalledWith(
      'Seed: sense .subur/, la subscripció no es toca (la fixen pnpm ops deploy i el panell)',
    )
  })
})
