// core/scripts/guards/templatesMajor.test.ts — la interfície del client només canvia amb el salt trencador (minor en 0.x, major des de 1.0)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { templatesNeedBump } from './templatesMajor'

const PKG = 'packages/core/package.json'
const DOCKERFILE = 'packages/core/templates/client/Dockerfile'
const dirs: string[] = []
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'x', GIT_AUTHOR_EMAIL: 'ci@subur.dev', GIT_COMMITTER_NAME: 'x', GIT_COMMITTER_EMAIL: 'ci@subur.dev' }
/** `exports: null`: un package.json sense el camp. */
const pkg = (version: string, exports: string[] | null = ['./site', './seed']) => `${JSON.stringify({ name: '@suburlabs/core', version, ...(exports && { exports: Object.fromEntries(exports.map((k) => [k, `./dist/${k.slice(2)}.js`])) }) }, null, 2)}\n`
const changeset = (bump: string, body = 'un canvi') => `---\n"@suburlabs/core": ${bump}\n"create-subur-app": ${bump}\n---\n\n${body}\n`

/** Un repositori de prova amb la forma del workspace, un commit i l'etiqueta donada; retorna les eines per canviar-lo. */
function repo(tag: string | null = 'v0.1.0', version = '0.1.0', exports: string[] | null = ['./site', './seed']) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'templates-major-'))
  dirs.push(dir)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env })
  const write = (files: Record<string, string>) => {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), text)
    }
  }
  const commit = (files: Record<string, string> = {}, rm: string[] = []) => {
    write(files)
    for (const file of rm) rmSync(path.join(dir, file))
    git('add', '-A')
    git('commit', '-q', '--allow-empty', '-m', 'canvi')
  }
  git('init', '-q', '-b', 'main')
  commit({
    [PKG]: pkg(version, exports),
    [DOCKERFILE]: 'FROM node:24\n',
    'packages/core/templates/client/_env.example': 'DATABASE_URL=\n',
    'packages/core/templates/generated/x.ts': 'export {}\n',
    'packages/core/src/templates/files.ts': 'export const FILES = []\n',
    'packages/core/src/css/core.css': '.a { color: var(--brand); }\n',
    'packages/core/src/css/primitives.css': '.b { color: var(--brand); }\n',
  })
  if (tag) git('tag', tag)
  return { dir, git, commit, check: () => templatesNeedBump(dir) }
}

beforeAll(() => {
  // La guarda hereta l'entorn: cap configuració global de git de la màquina hi pot intervenir.
  process.env.GIT_CONFIG_GLOBAL = '/dev/null'
  process.env.GIT_CONFIG_NOSYSTEM = '1'
})
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

describe('guarda de la interfície del client (templatesNeedBump)', () => {
  it('sense canvis: igual a l\'etiqueta', () => {
    const r = repo()
    r.commit({ 'packages/core/src/other.ts': 'export {}\n' })
    expect(r.check()).toEqual({ changed: [], ok: true, reason: 'interfície del client igual a v0.1.0' })
  })
  it('el contingut d\'un fitxer generat no és interfície (la llista sí)', () => {
    const r = repo()
    r.commit({ 'packages/core/templates/generated/x.ts': 'export const x = 1\n' })
    expect(r.check().ok).toBe(true)
  })
  it('un .env*.example no és interfície', () => {
    const r = repo()
    r.commit({ 'packages/core/templates/client/_env.example': 'DATABASE_URL=\nNOVA=\n' })
    expect(r.check()).toMatchObject({ changed: [], ok: true })
  })
  it('una plantilla del client sense changeset: falla i diu el fitxer', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n' })
    const res = r.check()
    expect(res.ok).toBe(false)
    expect(res.changed).toEqual([DOCKERFILE])
    expect(res.reason).toContain(DOCKERFILE)
  })
  it.each(['minor', 'major'])('en 0.x, un changeset %s per a @suburlabs/core basta', (bump) => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/x.md': changeset(bump) })
    expect(r.check()).toMatchObject({ ok: true, reason: 'interfície canviada des de v0.1.0 amb un changeset minor' })
  })
  it('un changeset patch no basta', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/x.md': changeset('patch') })
    expect(r.check().ok).toBe(false)
  })
  it('«major» al cos del changeset però no al frontmatter no compta', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/x.md': changeset('patch', '"@suburlabs/core": major') })
    expect(r.check().ok).toBe(false)
  })
  it('el README de .changeset no compta com a changeset', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/README.md': changeset('minor') })
    expect(r.check().ok).toBe(false)
  })
  it('la PR de versió: package.json a 0.2.0 i el changeset consumit', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/x.md': changeset('minor') })
    r.commit({ [PKG]: pkg('0.2.0') }, ['.changeset/x.md'])
    expect(r.check()).toMatchObject({ ok: true, reason: 'interfície canviada des de v0.1.0 i la versió 0.2.0 ja porta el salt minor' })
  })
  it('un fitxer generat nou canvia la llista: falla', () => {
    const r = repo()
    r.commit({ 'packages/core/templates/generated/y.ts': 'export {}\n' })
    expect(r.check()).toMatchObject({ ok: false, changed: ['packages/core/templates/generated (la llista de fitxers)'] })
  })
  it('un token consumit nou al CSS del nucli: falla', () => {
    const r = repo()
    r.commit({ 'packages/core/src/css/core.css': '.a { color: var(--brand); background: var(--nou); }\n' })
    expect(r.check()).toMatchObject({ ok: false, changed: ['packages/core/src/css (els tokens consumits)'] })
  })
  it('un subcamí d\'exports retirat sense changeset: falla', () => {
    const r = repo()
    r.commit({ [PKG]: pkg('0.1.0', ['./site']) })
    expect(r.check()).toMatchObject({ ok: false, changed: ['packages/core/package.json (exports retirats: ./seed)'] })
  })
  it('un subcamí d\'exports afegit no és un canvi trencador', () => {
    const r = repo()
    r.commit({ [PKG]: pkg('0.1.0', ['./site', './seed', './nou']) })
    expect(r.check()).toMatchObject({ ok: true, changed: [] })
  })
  it.each([['patch', false], ['minor', false], ['major', true]] as const)('des de 1.0, un changeset %s: ok = %s', (bump, ok) => {
    const r = repo('v1.2.0', '1.2.0')
    r.commit({ [DOCKERFILE]: 'FROM node:25\n', '.changeset/x.md': changeset(bump) })
    expect(r.check().ok).toBe(ok)
  })
  it('src/templates/files.ts és interfície: canviat sense changeset, falla', () => {
    const r = repo()
    r.commit({ 'packages/core/src/templates/files.ts': 'export const FILES = [\'x\']\n' })
    expect(r.check()).toMatchObject({ ok: false, changed: ['packages/core/src/templates/files.ts'] })
  })
  it('un token consumit nou només a primitives.css: falla', () => {
    const r = repo()
    r.commit({ 'packages/core/src/css/primitives.css': '.b { color: var(--brand); margin: var(--x); }\n' })
    expect(r.check()).toMatchObject({ ok: false, changed: ['packages/core/src/css (els tokens consumits)'] })
  })
  it('un package.json sense exports no fa caure la guarda', () => {
    const r = repo('v0.1.0', '0.1.0', null)
    r.commit({ 'packages/core/src/other.ts': 'export {}\n' })
    expect(r.check()).toEqual({ changed: [], ok: true, reason: 'interfície del client igual a v0.1.0' })
  })
  it.each([['1.3.0', false], ['2.0.0', true]] as const)('des de 1.0, la PR de versió a %s sense changeset: ok = %s (només un major porta el salt)', (version, ok) => {
    const r = repo('v1.2.0', '1.2.0')
    r.commit({ [DOCKERFILE]: 'FROM node:25\n' })
    r.commit({ [PKG]: pkg(version) })
    expect(r.check().ok).toBe(ok)
  })
  it('una etiqueta backup-v* posterior no compta: es compara amb l\'última v*', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n' })
    r.git('tag', 'backup-v9.0.0')
    const res = r.check()
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('des de v0.1.0')
  })
  it('sense cap etiqueta v*: res a comparar', () => {
    const r = repo(null)
    r.git('tag', 'backup-v1.0.0')
    r.commit({ [DOCKERFILE]: 'FROM node:25\n' })
    expect(r.check()).toEqual({ changed: [], ok: true, reason: 'cap etiqueta v*: res a comparar' })
  })
  it('un clon superficial falla', () => {
    const r = repo()
    r.commit({ [DOCKERFILE]: 'FROM node:25\n' })
    const clone = mkdtempSync(path.join(os.tmpdir(), 'templates-major-shallow-'))
    dirs.push(clone)
    // Amb un camí local sense `file://`, git ignora `--depth` i el clon no és superficial.
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${r.dir}`, path.join(clone, 'c')], { env })
    expect(templatesNeedBump(path.join(clone, 'c'))).toEqual({ changed: [], ok: false, reason: 'clon superficial: cal fetch-depth 0' })
  })
})
