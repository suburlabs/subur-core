// core/packages/core/tests/int/engineDeps.int.spec.ts — opció (b) de l'spec §3.1 (pla E2, R3): el motor és dependència exacta
// del nucli; cap client el declara; la demo (membre del workspace amb el paquet injectat) el declara a les mateixes versions.
// (Abans: peers.int.spec.ts, peers exactes = demo.)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { isEnginePackage } from '../../src/templates/files.js'

const here = path.dirname(fileURLToPath(import.meta.url))
type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }
const read = (p: string) => JSON.parse(readFileSync(path.resolve(here, p), 'utf8')) as Pkg
const core = read('../../package.json')
const demo = read('../../../../examples/demo/package.json')
const MINIMUM = ['next', 'payload', 'react', 'react-dom', 'tailwindcss', '@tailwindcss/postcss', 'eslint-config-next', 'graphql', '@payloadcms/db-postgres', '@payloadcms/next', '@payloadcms/ui', '@payloadcms/richtext-lexical']
const EXACT = /^\d+\.\d+\.\d+$/
const HOIST = ['next', 'react', 'react-dom', 'payload', '@payloadcms/*', 'tailwindcss', '@tailwindcss/*', 'eslint-config-next', 'graphql']
const patternsOf = (npmrc: string) => [...npmrc.matchAll(/^public-hoist-pattern\[\]=(\S+)$/gm)].map((m) => m[1])
// El predicat de `subur check` (graphql hi és: el nucli el porta exacte i el .npmrc el hissa)
const coreEngine = Object.entries(core.dependencies ?? {}).filter(([n]) => isEnginePackage(n))

describe('el motor com a dependència exacta (spec §3.1, opció (b))', () => {
  it('cap peerDependencies al nucli', () => {
    expect(core.peerDependencies).toBeUndefined()
  })
  it('el conjunt mínim hi és, i cada paquet del motor és exacte', () => {
    for (const name of MINIMUM) expect(core.dependencies?.[name], name).toBeDefined()
    expect(coreEngine.length).toBeGreaterThanOrEqual(MINIMUM.length)
    for (const [name, version] of coreEngine) expect(version, name).toMatch(EXACT)
  })
  it('tots els @payloadcms/* van amb la versió de payload', () => {
    for (const [name, version] of coreEngine.filter(([n]) => n.startsWith('@payloadcms/'))) expect(version, name).toBe(core.dependencies!.payload)
  })
  it('cap paquet del motor a devDependencies del nucli (hi serien dos cops)', () => {
    expect(Object.keys(core.devDependencies ?? {}).filter(isEnginePackage)).toEqual([])
  })
  // La demo declara tot el motor del nucli llevat dels connectors @tailwindcss/* (només els carreguen core.css, resolt a la còpia
  // injectada, i el postcss.config hissat) i de graphql (el .npmrc el hissa; ho fixa la prova de més avall):
  // «el que el panell importa» no es pot llegir d'un package.json i tampoc n'hi hauria prou (el bug d'E1 era @payloadcms/ui, que
  // la demo no importa directament) (ronda 2, X3).
  const DEMO_ENGINE = (n: string) => isEnginePackage(n) && n !== 'graphql' && !n.startsWith('@tailwindcss/')
  it('graphql és del motor: el nucli el porta exacte (és a MINIMUM) i la demo, explícitament, no el declara', () => {
    expect(isEnginePackage('graphql')).toBe(true)
    expect(Object.fromEntries(coreEngine).graphql).toMatch(EXACT)
    expect(DEMO_ENGINE('graphql')).toBe(false)
  })
  it('la demo declara exactament el motor del nucli llevat de @tailwindcss/* i graphql, a les mateixes versions, en els dos sentits (R3)', () => {
    const demoEngine = Object.entries({ ...demo.dependencies, ...demo.devDependencies }).filter(([n]) => DEMO_ENGINE(n))
    expect(Object.fromEntries(demoEngine.sort(([a], [b]) => a.localeCompare(b)))).toEqual(Object.fromEntries(coreEngine.filter(([n]) => DEMO_ENGINE(n))))
  })
  it('graphql i cap @tailwindcss/* no es declaren a la demo: els hissa el .npmrc', () => {
    expect(Object.keys({ ...demo.dependencies, ...demo.devDependencies }).filter((n) => n === 'graphql' || n.startsWith('@tailwindcss/'))).toEqual([])
  })
  it('el .npmrc del workspace hissa exactament els 9 patrons del client', () => {
    expect(patternsOf(readFileSync(path.resolve(here, '../../../../.npmrc'), 'utf8'))).toEqual(HOIST)
  })
})
