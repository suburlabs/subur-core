// core/scripts/guards/templatesMajor.ts — la interfície del client només canvia amb un salt trencador: minor en 0.x, major després (spec §3.7, §0.4; pla E2, R6)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** El que `subur check` compara al client (R5), tret dels .env*.example (R11). */
const INTERFACE_PATHS = ['packages/core/templates/client', 'packages/core/src/templates/files.ts']
const ENV_EXAMPLES = /^packages\/core\/templates\/client\/_env.*\.example$/
const git = (dir: string, args: string[]) => execFileSync('git', ['-c', 'color.ui=never', ...args], { cwd: dir, encoding: 'utf8' })
const consumedTokens = (css: string) => [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))].sort().join(',')
const major = (v: string) => Number(v.split('.')[0])
const minor = (v: string) => Number(v.split('.')[1])
/** `0.x`: minor; des d'`1.0.0`: major (R6). */
const breakingBump = (fromVersion: string) => (major(fromVersion) === 0 ? 'minor' : 'major')

export function templatesNeedBump(dir: string): { changed: string[]; ok: boolean; reason: string } {
  if (spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: dir, encoding: 'utf8' }).stdout.trim() === 'true') return { changed: [], ok: false, reason: 'clon superficial: cal fetch-depth 0' }
  const tag = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { cwd: dir, encoding: 'utf8' })
  if (tag.status !== 0) return { changed: [], ok: true, reason: 'cap etiqueta v*: res a comparar' }
  const ref = tag.stdout.trim()
  const tagVersion = ref.slice(1)
  const changed = git(dir, ['diff', '--name-only', ref, 'HEAD', '--', ...INTERFACE_PATHS]).trim().split('\n').filter((f) => f && !ENV_EXAMPLES.test(f))
  const names = (rev: string) => git(dir, ['ls-tree', '-r', '--name-only', rev, '--', 'packages/core/templates/generated']).trim()
  if (names(ref) !== names('HEAD')) changed.push('packages/core/templates/generated (la llista de fitxers)')
  const css = (rev: string) => ['core', 'primitives'].map((f) => { const r = spawnSync('git', ['show', `${rev}:packages/core/src/css/${f}.css`], { cwd: dir, encoding: 'utf8' }); return r.status === 0 ? r.stdout : '' }).join('\n')
  if (consumedTokens(css(ref)) !== consumedTokens(css('HEAD'))) changed.push('packages/core/src/css (els tokens consumits)')
  // Un subcamí d'`exports` que desapareix trenca el client (§3.7); un d'afegit, no.
  const exportsOf = (rev: string) => Object.keys((JSON.parse(git(dir, ['show', `${rev}:packages/core/package.json`])) as { exports?: Record<string, unknown> }).exports ?? {})
  const removed = exportsOf(ref).filter((k) => !exportsOf('HEAD').includes(k))
  if (removed.length > 0) changed.push(`packages/core/package.json (exports retirats: ${removed.join(', ')})`)
  if (changed.length === 0) return { changed, ok: true, reason: `interfície del client igual a ${ref}` }
  const bump = breakingBump(tagVersion)
  const current = (JSON.parse(readFileSync(path.join(dir, 'packages/core/package.json'), 'utf8')) as { version: string }).version
  const bumped = bump === 'major' ? major(current) > major(tagVersion) : major(current) > major(tagVersion) || minor(current) > minor(tagVersion)
  if (bumped) return { changed, ok: true, reason: `interfície canviada des de ${ref} i la versió ${current} ja porta el salt ${bump}` }
  const dirCs = path.join(dir, '.changeset')
  const frontmatter = (text: string) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? ''
  const has = existsSync(dirCs) && readdirSync(dirCs).filter((f) => f.endsWith('.md') && f !== 'README.md').some((f) => new RegExp(`^["']@suburlabs/core["']:\\s*(?:${bump}${bump === 'minor' ? '|major' : ''})$`, 'm').test(frontmatter(readFileSync(path.join(dirCs, f), 'utf8'))))
  return has ? { changed, ok: true, reason: `interfície canviada des de ${ref} amb un changeset ${bump}` } : { changed, ok: false, reason: `interfície del client canviada des de ${ref} sense cap changeset ${bump} per a @suburlabs/core (R6): ${changed.join(', ')}` }
}

if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const { ok, reason } = templatesNeedBump(process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
  console[ok ? 'log' : 'error'](`plantilles: ${reason}`)
  process.exit(ok ? 0 : 1)
}
