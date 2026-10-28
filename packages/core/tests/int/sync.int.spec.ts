// core/packages/core/tests/int/sync.int.spec.ts — `subur sync` sobre un client de prova (pla E2, R15)
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

import { GENERATED_FILES, IMPORT_MAP } from '../../src/templates/files.js'
import { readGenerated } from '../../src/templates/render.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// A la mateixa fondària que tests/fixtures/app (el seu tsconfig estén ../../../tsconfig.json) i ignorat (**/.tmp-app-*/).
const app = mkdtempSync(path.join(PKG, 'tests/fixtures/.tmp-app-sync-'))
cpSync(path.join(PKG, 'tests/fixtures/app'), app, { recursive: true })
// Sense base ni secret a l'entorn: sync en posa de mentida (el globalSetup els fixa per a la resta de proves).
const { DATABASE_URL: _db, SUBUR_SECRET: _secret, ...envSense } = process.env
const subur = (args: string[], cwd = app) => spawnSync(process.execPath, [path.join(PKG, 'bin/subur.js'), ...args], { cwd, encoding: 'utf8', env: envSense as NodeJS.ProcessEnv })
afterAll(() => rmSync(app, { force: true, recursive: true }))

describe('subur sync', { timeout: 120_000 }, () => {
  it('escriu els 19 fitxers generats i el mapa d\'imports, sense base de dades ni secret', () => {
    const r = subur(['sync'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^subur sync: 20 fitxers \(20 escrits\)$/m)
    for (const f of [...GENERATED_FILES, IMPORT_MAP]) expect(existsSync(path.join(app, f)), f).toBe(true)
    for (const { clientPath, text } of readGenerated()) expect(readFileSync(path.join(app, clientPath), 'utf8'), clientPath).toBe(text)
    expect(readFileSync(path.join(app, IMPORT_MAP), 'utf8')).toMatch(/export const importMap = \{/)
  })
  it('és idempotent: la segona passada no escriu res i el mapa d\'imports és idèntic', () => {
    const before = readFileSync(path.join(app, IMPORT_MAP), 'utf8')
    const r = subur(['sync'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^subur sync: 20 fitxers \(0 escrits\)$/m)
    expect(readFileSync(path.join(app, IMPORT_MAP), 'utf8')).toBe(before)
  })
  it('torna a escriure un fitxer generat que algú ha editat', () => {
    const f = path.join(app, 'src/proxy.ts')
    writeFileSync(f, `${readFileSync(f, 'utf8')}// editat\n`)
    const r = subur(['sync'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/\(1 escrits\)/)
    expect(readFileSync(f, 'utf8')).not.toContain('// editat')
  })
  it('torna a generar el mapa d\'imports si algú l\'ha editat: el motor el reescriu idèntic i compta com a escrit', () => {
    const f = path.join(app, IMPORT_MAP)
    const before = readFileSync(f, 'utf8')
    writeFileSync(f, `${before}// editat\n`)
    const r = subur(['sync'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^subur sync: 20 fitxers \(1 escrits\)$/m)
    expect(readFileSync(f, 'utf8')).toBe(before)
  })
  it('el mapa d\'imports el genera el motor de debò: una configuració trencada fa fallar sync', () => {
    const config = path.join(app, 'src/payload.config.ts')
    const original = readFileSync(config, 'utf8')
    writeFileSync(config, `${original}\nthrow new Error('config trencada a posta')\n`)
    try {
      const r = subur(['sync'])
      // Codi 1 (no 2, d'ús): l'error del motor (stderr heretat) i el de sync, que cita l'ordre del motor que ha fallat.
      expect(r.status, r.stderr).toBe(1)
      expect(r.stderr).toMatch(/config trencada a posta/)
      expect(r.stderr).toMatch(/^subur sync: Command failed: .*generate:importmap$/m)
    } finally {
      writeFileSync(config, original)
    }
  })
  it('fora d\'un client: codi 1 i el fitxer que falta, sense tocar res', () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), 'subur-sync-empty-'))
    try {
      const r = subur(['sync'], empty)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/falta src\/site\/site\.config\.ts/)
      expect(existsSync(path.join(empty, 'src'))).toBe(false)
    } finally {
      rmSync(empty, { force: true, recursive: true })
    }
  })
  it('un client sense el motor instal·lat: codi 1, una línia amb el prefix de sync, sense traça', () => {
    const bare = mkdtempSync(path.join(os.tmpdir(), 'subur-sync-bare-'))
    try {
      for (const f of ['src/site/site.config.ts', 'src/payload.config.ts']) { mkdirSync(path.dirname(path.join(bare, f)), { recursive: true }); cpSync(path.join(app, f), path.join(bare, f)) }
      writeFileSync(path.join(bare, 'package.json'), '{ "name": "bare", "private": true }\n')
      const r = subur(['sync'], bare)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^subur sync: no es resol el motor des del client: Cannot find module 'payload'/m)
      expect(r.stderr.trim().split('\n')).toHaveLength(1)
    } finally {
      rmSync(bare, { force: true, recursive: true })
    }
  })
  it('sync amb arguments és un error d\'ús (codi 2)', () => {
    expect(subur(['sync', '--force']).status).toBe(2)
  })
})
