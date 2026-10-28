import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm
/** `import('…')` amb un literal: només se'n recullen els nus, a `lazy` (no se segueixen), perquè un `import()` mandrós del panell es vegi. */
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g
const STYLE_IMPORT = /^\s*@(?:import|use)\s+['"]([^'"]+)['"]/gm
/** El SCSS propi d'`AdminBar` (barra d'editors a les pàgines públiques) només pot importar `@payloadcms/ui/scss` (variables i mixins; ruling C1). */
const STYLE_EXEMPT = new Map([['components/AdminBar/index.scss', ['@payloadcms/ui/scss']]])

const rel = (file: string) => path.relative(SRC, file)
const isFile = (file: string) => existsSync(file) && statSync(file).isFile()

/**
 * Tancament estàtic d'imports de valor (els `import type` no compten; dels `import()`, els nus van a `lazy`, sense seguir-los). Els fulls d'estil hi entren
 * com a `css:<especificador>` i, a més, se'n llegeixen els `@import`/`@use`: els nus van a `bare` (el CSS del panell del
 * motor hi arribaria així). `unresolved` recull els especificadors relatius sense fitxer: cada cas l'exigeix buit.
 */
function closure(entry: string): { bare: Set<string>; files: Set<string>; lazy: Set<string>; unresolved: string[] } {
  const files = new Set<string>()
  const bare = new Set<string>()
  const lazy = new Set<string>()
  const unresolved: string[] = []
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    const source = readFileSync(file, 'utf8')
    if (/\.(css|scss)$/.test(file)) {
      const exempt = STYLE_EXEMPT.get(rel(file))
      if (exempt) {
        expect([...source.matchAll(STYLE_IMPORT)].map((m) => m[1])).toEqual(exempt)
        return
      }
      for (const [, spec] of source.matchAll(STYLE_IMPORT)) {
        if (!spec.startsWith('.')) { bare.add(spec); continue }
        const target = path.resolve(path.dirname(file), spec)
        const next = [target, `${target}.scss`, path.join(path.dirname(target), `_${path.basename(target)}.scss`)].find(isFile)
        if (next) visit(next)
        else unresolved.push(`${rel(file)} → ${spec}`)
      }
      return
    }
    for (const [, spec] of source.matchAll(DYNAMIC_IMPORT)) if (!spec.startsWith('.')) lazy.add(spec)
    for (const [, spec] of source.matchAll(VALUE_IMPORT)) {
      if (!spec.startsWith('.')) { bare.add(spec); continue }
      const target = path.resolve(path.dirname(file), spec)
      if (/\.(css|scss)$/.test(spec)) bare.add(`css:${spec}`)
      const base = target.replace(/\.js$/, '')
      // Les fonts TS primer; el JS pla (el handler de la cau i el seu codec) tal com s'escriu.
      const next = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext).concat(target).find(isFile)
      if (next) visit(next)
      else unresolved.push(`${rel(file)} → ${spec}`)
    }
  }
  visit(path.join(SRC, entry))
  return { bare, files, lazy, unresolved }
}
const isClient = (file: string) => /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/.test(readFileSync(file, 'utf8'))
const walk = (dir: string): string[] => readdirSync(dir).flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e)) : [path.join(dir, e)]))
const SERVER = (s: string) => s === 'payload' || s.startsWith('@payloadcms/db-') || s === 'pg' || s === 'sharp' || s.startsWith('node:')
/** El graf de configuració (§3.2.1). Totes les entrades existeixen i es comproven sempre: un canvi de nom falla, no s'omet (D20).
 *  `gate/cli.ts`, `bin/sync.ts`, `bin/check.ts` i `bin/update.ts` hi són com a entrades pròpies: `bin/subur.ts` els carrega amb
 *  `await import()`, que `closure` no segueix (residu de C66; els imports de la porta són `node:*`, `pg`, `tsx` i mòduls propis;
 *  els de sync, `node:*` i `../templates/*`; els de check, `node:*`, `../templates/*` (i `../utilities/contrast`) i
 *  `./loadClient`; els d'update, `node:*`, `../templates/*` i `./loadClient`: cap `next/*` ni CSS). */
const GRAPH_1 = ['config/index.ts', 'contract/index.ts', 'migrations-index/index.ts', 'bin/subur.ts', 'bin/sync.ts', 'bin/check.ts', 'bin/update.ts', 'seed/exports.ts', 'gate/index.ts', 'gate/cli.ts']
/** Els subcamins que el `next.config` del client i Next carreguen amb Node pla: `./next` (withSubur) i `./cache-handler`. */
const PLAIN_NODE = ['next/index.ts', 'cache/handler.js']
/** Tot el panell del motor (`@payloadcms/next/*`) i els seus CSS compilats de `@payloadcms/ui` (ruling C1); el SCSS d'`AdminBar` és una exempció exacta a `STYLE_EXEMPT`. */
const ENGINE_PANEL = (s: string) => s.startsWith('@payloadcms/next/') || /^@payloadcms\/ui\/(scss|css|styles\.css)(\/|$)/.test(s)

describe('dos grafs (spec §3.2.3)', () => {
  for (const entry of GRAPH_1) {
    it(`graf de configuració (${entry}): cap subur-site-config, cap 'use client', cap CSS, cap next/* estàtic`, () => {
      const { bare, files, lazy, unresolved } = closure(entry)
      expect(unresolved).toEqual([])
      expect([...bare].filter((s) => s === 'subur-site-config' || s.startsWith('css:') || s === 'next' || s.startsWith('next/') || /\.(css|scss)$/.test(s) || /^@payloadcms\/(ui|next)\/(css|styles\.css|scss)(\/|$)/.test(s))).toEqual([])
      // `next/*` sí que hi pot entrar amb `import()` (el hook d'invalidació carrega `next/cache.js` així, a posta).
      expect([...lazy].filter((s) => s === 'subur-site-config' || /\.(css|scss)$/.test(s))).toEqual([])
      expect([...files].filter(isClient).map(rel)).toEqual([])
    })
  }

  it('totes les entrades del graf 1 existeixen', () => expect(GRAPH_1.filter((e) => !existsSync(path.join(SRC, e)))).toEqual([]))

  for (const entry of PLAIN_NODE) {
    it(`${entry} es carrega amb Node pla: cap subur-site-config, cap 'use client', cap CSS, cap next/* en temps d'execució`, () => {
      const { bare, files, lazy, unresolved } = closure(entry)
      expect(unresolved).toEqual([])
      expect([...bare].filter((s) => s === 'subur-site-config' || s.startsWith('css:') || s === 'next' || s.startsWith('next/') || /\.(css|scss)$/.test(s) || /^@payloadcms\/(ui|next)\/(css|styles\.css|scss)(\/|$)/.test(s))).toEqual([])
      // `next/*` sí que hi pot entrar amb `import()` (el hook d'invalidació carrega `next/cache.js` així, a posta).
      expect([...lazy].filter((s) => s === 'subur-site-config' || /\.(css|scss)$/.test(s))).toEqual([])
      expect([...files].filter(isClient).map(rel)).toEqual([])
    })
  }

  it('cap mòdul \'use client\' de src arriba, ni transitivament, al motor de servidor', () => {
    const clients = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts') && isClient(file))
    expect(clients.length).toBeGreaterThan(0)
    const offenders = clients.flatMap((file) => {
      const { bare, lazy, unresolved } = closure(rel(file))
      return [...bare, ...lazy].filter(SERVER).map((s) => `${rel(file)} → ${s}`).concat(unresolved)
    })
    expect(offenders).toEqual([])
  })

  it('el graf del proxy només conté ./proxy, l\'i18n pur, ./site i subur-site-config', () => {
    const { bare, files, lazy, unresolved } = closure('proxy/index.ts')
    expect(unresolved).toEqual([])
    expect([...bare].sort()).toEqual(['next/server', 'subur-site-config'])
    expect([...lazy]).toEqual([])
    expect([...files].map(rel).sort()).toEqual(['i18n/catalog.ts', 'i18n/config.ts', 'i18n/localeRedirect.ts', 'i18n/resolveLocale.ts', 'proxy/index.ts', 'site/index.ts'])
  })

  it('el barril públic ./app no arriba al panell del motor ni als seus estils (ruling C1, D29)', () => {
    const { bare, files, lazy, unresolved } = closure('app/index.ts')
    expect(unresolved).toEqual([])
    expect([...bare, ...lazy].filter(ENGINE_PANEL)).toEqual([])
    expect([...files].map(rel).filter((f) => f === 'app/panel.tsx' || f === 'app/api.ts')).toEqual([])
  })

  it('el barril ./app/admin porta el panell del motor, però cap CSS: el fan els fitxers de ruta del grup (subur) (D29)', () => {
    const { bare, lazy, unresolved } = closure('app-admin/index.ts')
    expect(unresolved).toEqual([])
    expect([...bare].filter((s) => /^@payloadcms\/next\//.test(s)).sort()).toEqual(['@payloadcms/next/layouts', '@payloadcms/next/routes', '@payloadcms/next/views'])
    expect([...bare, ...lazy].filter((s) => s === '@payloadcms/next/css' || s.startsWith('css:') || s.startsWith('@payloadcms/ui/scss'))).toEqual([])
  })

  // El catàleg del bàner (`consent/messages.ts`) el comparteixen el proveïdor de client i el backend de servidor:
  // si mai portés `'use client'` o un import de valor de React, el backend l'arrossegaria.
  it('el backend de consentiment no arriba a cap mòdul \'use client\'', () => {
    const { files, unresolved } = closure('consent/backend.ts')
    expect(unresolved).toEqual([])
    expect([...files].filter(isClient).map(rel)).toEqual([])
  })

  it('cap mòdul del paquet importa @payloadcms/next/css (D29)', () => {
    const importers = walk(SRC).filter((f) => /\.(ts|tsx|js)$/.test(f) && /['"]@payloadcms\/next\/css['"]/.test(readFileSync(f, 'utf8')))
    expect(importers.map(rel)).toEqual([])
  })
})
