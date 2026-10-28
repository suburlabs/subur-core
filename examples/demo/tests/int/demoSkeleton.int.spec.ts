import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { readSuburContract } from '@suburlabs/core/contract'
import { describe, expect, it } from 'vitest'

import { GENERATED_FILES, IMPORT_MAP, REQUIRED_GITIGNORE } from '../../../../packages/core/src/templates/files.js'
import { siteConfig } from '../../src/site/site.config'

describe('l\'esquelet de la demo (spec §10 E1)', () => {
  it('identitat genèrica', () => {
    expect(siteConfig).toMatchObject({ clientLocale: 'ca', defaultLocale: 'ca', domain: 'demo.example', id: 'demo', name: 'Reformes Exemple' })
  })
  it('la fixture .subur/ passa pel parser real (ruling P7) i no entra a la imatge', () => {
    const contract = readSuburContract(process.cwd(), 'demo')
    expect(contract.maxLanguages).toBe(3)
    expect(contract.footerCredit).toBe(true)
    expect(contract.modules.limits.languages).toBe(3)   // maxLanguages surt d'aquí (D12)
    expect(readFileSync('.dockerignore', 'utf8').split('\n').map((l) => l.trim())).toContain('.subur/')
  })
  it('subur facts --json dona tres idiomes actius en l\'ordre del seed', () => {
    const facts = JSON.parse(execFileSync('pnpm', ['-s', 'exec', 'subur', 'facts', '--json'], { encoding: 'utf8' })) as { activeLocales: string[]; id: string }
    expect(facts).toMatchObject({ activeLocales: ['ca', 'es', 'en'], id: 'demo' })
  })
  it('cada @import relatiu de globals.css apunta a un fitxer que existeix (D30)', () => {
    const css = readFileSync('src/app/(frontend)/globals.css', 'utf8')
    const relative = [...css.matchAll(/@import '(\.[^']+)'/g)].map((m) => m[1])
    expect(relative).toEqual(['../../site/theme.css'])
    for (const spec of relative) expect(existsSync(path.join('src/app/(frontend)', spec)), spec).toBe(true)
  })
  it('cap fitxer generat es versiona (tampoc com a fitxer nou), tots existeixen després de sync i git els ignora (spec §4.2; R4)', () => {
    // --cached --others --exclude-standard: també els fitxers nous encara sense commit, no els ignorats (D31, D47; sonda S11 d'E1)
    const tracked = execFileSync('git', ['--literal-pathspecs', 'ls-files', '--cached', '--others', '--exclude-standard', '--', 'src/app', 'src/proxy.ts', 'src/site/seed/run.ts'], { encoding: 'utf8' }).trim().split('\n')
    expect(tracked).toEqual(['src/app/(subur)/custom.scss'])
    // check-ignore no admet --literal-pathspecs (128); --no-index perquè cap generat sigui a l'índex
    for (const f of [...GENERATED_FILES, IMPORT_MAP]) {
      expect(existsSync(f), f).toBe(true)
      const r = spawnSync('git', ['check-ignore', '-q', '--no-index', '--', f])
      expect(r.status, `${f} ignorat (codi ${r.status})`).toBe(0)
    }
    const lines = readFileSync('.gitignore', 'utf8').split('\n')
    for (const line of REQUIRED_GITIGNORE) expect(lines, line).toContain(line)
    expect(readFileSync('.gitignore', 'utf8')).toBe(readFileSync('../../packages/core/templates/client/_gitignore', 'utf8'))
  })
})
