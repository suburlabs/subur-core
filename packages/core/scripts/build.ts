import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const at = (...parts: string[]) => path.join(PKG, ...parts)
type Target = string | { types?: string; default?: string }
const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8')) as { exports: Record<string, Target> }

/** `./dist/x/y.js` (o `./dist/x/y.d.ts` d'un export només de tipus) → `src/x/y.ts(x)`; null per a CSS i el handler pla. */
export function sourceOf(distFile: string): string | null {
  const js = distFile.replace(/\.d\.ts$/, '.js')
  if (!js.endsWith('.js')) return null
  const base = js.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '')
  for (const ext of ['.ts', '.tsx']) if (existsSync(at(base + ext))) return base + ext
  return null
}

const targets = Object.values(pkg.exports).flatMap((t) => (typeof t === 'string' ? [t] : [t.default ?? t.types]))
const walk = (dir: string): string[] => readdirSync(dir).flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e)) : [path.join(dir, e)]))
/** Declaracions escrites a mà (tsc no les emet): subur-site-config.d.ts, environment.d.ts, cache/handler.d.ts. */
const handDts = walk(at('src')).map((f) => path.relative(PKG, f)).filter((f) => f.endsWith('.d.ts') && !f.startsWith('src/migrations/'))
// El bin és el shim versionat bin/subur.js (Task 7), que importa dist/bin/subur.js: és un punt d'entrada.
const entries = [...new Set([...targets.filter((t): t is string => !!t).map(sourceOf), existsSync(at('src/bin/subur.ts')) ? 'src/bin/subur.ts' : null].filter((s): s is string => s !== null))].sort()

/** Només com a punt d'entrada: importar `sourceOf` des d'una prova no ha d'esborrar `dist` (nit de la ronda 2). */
function build() {
  rmSync(at('dist'), { force: true, recursive: true })
  mkdirSync(at('.build'), { recursive: true })
  writeFileSync(at('.build/tsconfig.json'), `${JSON.stringify({ extends: '../tsconfig.build.json', files: [...entries, ...handDts].map((e) => `../${e}`), include: [] }, null, 2)}\n`)
  execFileSync(at('node_modules/.bin/tsc'), ['-p', at('.build/tsconfig.json')], { stdio: 'inherit' })

  // tsc no emet: CSS/SCSS (al costat del component), el handler pla de la cau (JS) i les declaracions escrites a mà.
  for (const file of walk(at('src'))) {
    const rel = path.relative(at('src'), file)
    if (/\.(css|scss)$/.test(rel) || /^cache\/(handler|codec)\.js$/.test(rel) || (rel.endsWith('.d.ts') && !rel.startsWith('migrations/'))) {
      mkdirSync(path.dirname(at('dist', rel)), { recursive: true })
      cpSync(file, at('dist', rel))
    }
  }
  // tsc 5.7 no emet els `/// <reference path>` d'una font (i amb preserve="true" apuntaria a src/): la referència a
  // la declaració del client s'escriu a la sortida (D38; sonda S13).
  const typesIndex = at('dist/types/index.d.ts')
  // Només quan la declaració existeix (Task 8): abans, la referència apuntaria a un fitxer inexistent (nit de la ronda 3).
  if (existsSync(typesIndex) && existsSync(at('dist/subur-site-config.d.ts'))) writeFileSync(typesIndex, `/// <reference path="../subur-site-config.d.ts" />\n${readFileSync(typesIndex, 'utf8')}`)
  if (existsSync(at('assets'))) cpSync(at('assets'), at('dist/assets'), { recursive: true })
  // El motor llegeix com a migració tot .ts/.js del directori (readMigrationFiles): cap .d.ts hi pot quedar (spec §3.3).
  if (existsSync(at('dist/migrations'))) for (const f of readdirSync(at('dist/migrations'))) if (f.endsWith('.d.ts')) rmSync(at('dist/migrations', f))
  console.log(`build: ${entries.length} punts d'entrada, ${handDts.length} declaracions`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build()
