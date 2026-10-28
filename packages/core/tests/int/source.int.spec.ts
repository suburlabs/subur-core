import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
const code = walk(SRC).filter((file) => /\.(ts|tsx|js)$/.test(file) && !file.endsWith('.d.ts'))
const SPEC = /(?:from\s+|import\s*\(\s*|import\s+|export\s+[^'"]*?from\s+)['"]([^'"]+)['"]/g
const specifiers = (file: string) => [...readFileSync(file, 'utf8').matchAll(SPEC)].map((m) => m[1])
const rel = (file: string) => path.relative(SRC, file)

/** Cap: des de la Task 13 (motor del seed), `heroPhotos` rep el `payload` del client i ja no importa la configuració. */
export const KNOWN_CONFIG_IMPORTERS: string[] = []
/** Cap: des de la Task 13, el contingut del client arriba a `runSeed` com a argument i no hi ha cap `./content` per resoldre. */
export const KNOWN_UNRESOLVED: string[] = []

describe('codi del paquet (spec §3.1)', () => {
  it('cap especificador @/ (cap àlies al paquet)', () => {
    expect(code.filter((f) => specifiers(f).some((s) => s.startsWith('@/'))).map(rel)).toEqual([])
  })
  it('cap import relatiu sense extensió .js', () => {
    const bad = code.flatMap((f) => specifiers(f).filter((s) => s.startsWith('.') && !/\.(js|css|scss|json)$/.test(s)).map((s) => `${rel(f)} → ${s}`))
    expect(bad).toEqual(KNOWN_UNRESOLVED)
  })
  it('cap fitxer importa @subur-config/@payload-config', () => {
    const importers = code.filter((f) => specifiers(f).some((s) => s === '@subur-config' || s === '@payload-config')).map(rel).sort()
    expect(importers).toEqual(KNOWN_CONFIG_IMPORTERS)
  })
  it('cap import del propi paquet per nom (@suburlabs/core/*): el graf de configuració no pot arribar al de render pel mapa d\'exports', () => {
    expect(code.filter((f) => specifiers(f).some((s) => s === '@suburlabs/core' || s.startsWith('@suburlabs/core/'))).map(rel)).toEqual([])
  })
  it('cap logo de la marca de Subur (spec §0.5, §3.6)', () => {
    const brand = new RegExp('Subur' + 'Logo')   // sense el literal: la guarda de la Task 19 no ha de trobar-lo en aquesta prova (D54)
    expect(code.map(rel).filter((f) => brand.test(f) || brand.test(readFileSync(path.join(SRC, f), 'utf8')))).toEqual([])
  })
})
