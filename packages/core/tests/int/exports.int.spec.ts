import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
type Target = string | { types?: string; default?: string }
const pkg = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { exports: Record<string, Target> }
/** Subcamins que només el bundler pot carregar (ruling P5): llegeixen `subur-site-config` o porten `'use client'`/CSS. */
const BUNDLER_ONLY = new Set(['./app', './app/admin', './proxy', './admin'])
/** Instantània dels noms exportats per subcamí (§3.7: canviar-los és una major). Cada tasca que afegeix un subcamí hi afegeix la seva entrada. */
const API: Record<string, string[]> = {
  './cache-handler': ['ALL_TAG', 'default', 'endPool', 'resetModuleState'],
  './config': ['SUPPORT_EMAIL_DEFAULT', 'buildSuburConfig', 'createPages', 'createSubscription', 'migrationDirOf', 'plugins', 'seoGenerators'],
  './contract': ['FACTS_SCRIPT', 'SUBUR_DIR', 'SuburContractError', 'collectFacts', 'hasModuleIn', 'parseFacts', 'readSuburContract'],
  './gate': ['assertGateDatabase', 'cacheGate', 'gatePlan', 'redactLine'],
  './migrations': ['migrations'],
  './next': ['withSubur'],
  './seed': ['flushSiteCacheAfterSeed', 'heading', 'heroPhotos', 'pageLink', 'paragraph', 'richText', 'runSeed', 'uiKeys', 'urlLink'],
  './site': ['defaultLocaleOf', 'defineSiteConfig', 'locales', 'seedOrderOf', 'supportedLocales'],
  './ui': ['Divider', 'Plaque', 'cn'],
}
const subpaths = Object.keys(pkg.exports).filter((s) => s !== './package.json')
const runtime = subpaths.filter((s) => { const t = pkg.exports[s]; return !BUNDLER_ONLY.has(s) && typeof t === 'object' && 'default' in t })
const node = (code: string, cwd = PKG) => execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' }).trim()

describe('exports de @suburlabs/core (spec §3.1)', () => {
  it.each(subpaths)('%s apunta a fitxers que existeixen a dist', (sub) => {
    const target = pkg.exports[sub]
    for (const file of typeof target === 'string' ? [target] : Object.values(target)) expect(existsSync(path.join(PKG, file!)), `${sub} → ${file}`).toBe(true)
  })

  it.each(runtime)('%s s\'importa amb node pla i exporta exactament els noms de l\'instantània', (sub) => {
    const names = node(`const m = await import('@suburlabs/core${sub.slice(1)}'); console.log(Object.keys(m).sort().join(','))`).split(',')
    expect(names).toEqual(API[sub])
  })

  it('cada subcamí amb runtime té la seva entrada a l\'instantània, i cap més', () => {
    expect(Object.keys(API).sort()).toEqual([...runtime].sort())
  })

  it('el client de prova resol @suburlabs/core per auto-referència (cap package.json propi; C7, C11, C19, C32)', () => {
    expect(existsSync(path.join(PKG, 'tests/fixtures/app/package.json'))).toBe(false)
    expect(node("const m = await import('@suburlabs/core/site'); console.log(typeof m.defineSiteConfig)", path.join(PKG, 'tests/fixtures/app/src'))).toBe('function')
  })

  it('migrationDirOf, des de dist, dona dist/migrations; SUBUR_MIGRATIONS_SRC només si PAYLOAD_MIGRATING ja hi és (C31, C40, D26: per això migrate-create.ts posa totes dues)', () => {
    const code = "const { migrationDirOf } = await import('@suburlabs/core/config'); console.log(JSON.stringify([migrationDirOf({}), migrationDirOf({ SUBUR_MIGRATIONS_SRC: '/x' }), migrationDirOf({ PAYLOAD_MIGRATING: 'true', SUBUR_MIGRATIONS_SRC: '/x' })]))"
    const [plain, ignored, honoured] = JSON.parse(node(code)) as string[]
    expect(plain).toBe(path.join(PKG, 'dist/migrations'))
    expect(ignored).toBe(plain)
    expect(honoured).toBe('/x')
  })

  it('./types només porta tipus i declara el mòdul del motor (C30, C41, C60, C67, C76)', () => {
    expect(pkg.exports['./types']).toEqual({ types: './dist/types/index.d.ts' })
    expect(readFileSync(path.join(PKG, 'dist/types/subur-types.d.ts'), 'utf8')).toMatch(/declare module 'payload'/)
    expect(readFileSync(path.join(PKG, 'dist/types/index.d.ts'), 'utf8')).toMatch(/^\/\/\/ <reference path="\.\.\/subur-site-config\.d\.ts" \/>/)
    expect(existsSync(path.join(PKG, 'dist/subur-site-config.d.ts'))).toBe(true)
  })

  it('./site no importa res en temps d\'execució', () => {
    expect(readFileSync(path.join(PKG, 'dist/site/index.js'), 'utf8').match(/^import .* from ['"][^.]/gm) ?? []).toEqual([])
  })
})
