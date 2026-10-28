// core/scripts/guards/history.test.ts — la guarda de l'historial sobre un repositori de prova; cap correu ni nom de client
// literal en aquest fitxer (la guarda de dades de client l'escaneja): tot es construeix en temps d'execució.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scanForClientData } from './clientData'
import { scanHistory } from './history'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// Partir per l'arrova: partir només el domini no basta (el prefix del noreply amb l'arrova i el primer tros del domini ja casa amb la regla de correus).
const NOREPLY = ['1+x', 'users.noreply.github.com'].join('@')
const BOT = ['41898282+github-actions[bot]', 'users.noreply.github.com'].join('@')
const PERSONAL = ['algu', 'gmail.com'].join('@')
const TRAILER = `Co-Authored-By: Claude <${['noreply', 'anthropic.com'].join('@')}>`
const CLIENT = 'sit' + 'ges'
const HEX = '0123456789abcdef'.repeat(2)
// Una IP del rang que la regla `ip` busca, construïda en temps d'execució (cap IP real escrita)
const IP = ['9' + '1', '98', '0', '1'].join('.')
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

let repo = ''
let shallow = ''
const hashes = new Map<string, string>()
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
const git = (args: string[], extra: Record<string, string> = {}) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...env, ...extra } })
const who = (author: string, committer: string) => ({ GIT_AUTHOR_NAME: 'x', GIT_AUTHOR_EMAIL: author, GIT_COMMITTER_NAME: 'x', GIT_COMMITTER_EMAIL: committer })

/** Un commit amb els fitxers donats (escrits o esborrats), el missatge i les identitats; es desa el hash amb l'etiqueta. */
function commit(label: string, opts: { files?: Record<string, string>; rm?: string[]; message: string; author?: string; committer?: string }) {
  for (const [file, text] of Object.entries(opts.files ?? {})) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    writeFileSync(path.join(repo, file), text)
  }
  for (const file of opts.rm ?? []) rmSync(path.join(repo, file))
  git(['add', '-A'])
  git(['commit', '-q', '--allow-empty', '-m', opts.message], who(opts.author ?? NOREPLY, opts.committer ?? NOREPLY))
  hashes.set(label, git(['rev-parse', 'HEAD']).trim())
}

beforeAll(() => {
  // La guarda hereta l'entorn: cap configuració global de git de la màquina hi pot intervenir.
  process.env.GIT_CONFIG_GLOBAL = '/dev/null'
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  repo = mkdtempSync(path.join(os.tmpdir(), 'history-guard-'))
  git(['init', '-q', '-b', 'main'])
  // (1) El lock real de core/ (amb el correu d'un tercer en un `deprecated:`) i el trailer de l'atribució del model.
  let lock = readFileSync(path.join(CORE, 'pnpm-lock.yaml'), 'utf8')
  if (!/deprecated:.*@/.test(lock)) lock += `\n# deprecated: ${['i', 'izs.me'].join('@')}\n`
  commit('net', { files: { 'pnpm-lock.yaml': lock, 'README.md': 'hola\n' }, message: `chore: net\n\n${TRAILER}` })
  commit('fitxer', { files: { 'notes.md': `una web per a ${CLIENT}\n` }, message: 'docs: notes' })
  commit('esborrat', { rm: ['notes.md'], message: 'docs: fora les notes' })
  commit('missatge', { message: `fix: la web de ${CLIENT}` })
  commit('token', { message: `fix: el token ${HEX}` })
  commit('autor', { message: 'chore: autor personal', author: PERSONAL })
  commit('committer', { message: 'chore: committer personal', committer: PERSONAL })
  commit('bot', { message: 'chore(deps): renovate', author: BOT })
  git(['checkout', '-q', '-b', 'side'])
  commit('branca', { files: { 'side.md': `${CLIENT}\n` }, message: 'docs: branca' })
  git(['checkout', '-q', 'main'])
  commit('no-ascii', { files: { 'docs/decisió.md': `${CLIENT}\n` }, message: 'docs: decisió' })
  commit('tabulador', { files: { 'docs/amb\ttab.md': `${CLIENT}\n` }, message: 'docs: tabulador' })
  // (12) Només el nom del fitxer porta la dada, el contingut és net: el nom del client dins d'un nom no ASCII, i una IP del
  // servidor just després d'una lletra no ASCII. Amb `core.quotePath=true` git escriu `\303\263` en lloc de `ó`: el nom
  // del client, que és ASCII, se segueix veient, però la IP queda enganxada a una xifra i el `\b` de la regla ja no hi casa.
  // És aquest segon cas el que fixa `-c core.quotePath=false`.
  commit('nom-no-ascii', { files: { [`docs/decisió-${CLIENT}.md`]: 'net\n' }, message: 'docs: nom' })
  commit('ip-no-ascii', { files: { [`docs/ó${IP}.md`]: 'net\n' }, message: 'docs: ip' })
  // Amb un camí local sense `file://`, git ignora `--depth` i el clon no és superficial.
  shallow = mkdtempSync(path.join(os.tmpdir(), 'history-guard-shallow-'))
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, path.join(shallow, 'c')], { env })
}, 60_000)

afterAll(() => {
  for (const dir of [repo, shallow]) if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('guarda de l\'historial (scanHistory)', () => {
  it('una troballa exacta per commit i regla, sobre totes les branques', () => {
    const label = new Map([...hashes].map(([l, h]) => [h, l]))
    const got = scanHistory(repo).map((f) => `${label.get(f.path) ?? f.path} ${f.rule}`).sort()
    expect(got).toEqual([
      'autor autor',
      'branca diff:client',
      'committer committer',
      'esborrat diff:client',
      'fitxer diff:client',
      'ip-no-ascii diff:ip',
      'missatge missatge:client',
      'no-ascii diff:client',
      'nom-no-ascii diff:client',
      'tabulador diff:client',
      'token token',
    ])
  })
  it('el commit net (lock amb correus de tercers, trailer del model) i el del bot no donen cap troballa', () => {
    const findings = scanHistory(repo)
    for (const label of ['net', 'bot']) expect(findings.filter((f) => f.path === hashes.get(label)), label).toEqual([])
  })
  it('cap troballa no porta la línia (ni el nom, ni el token, ni el correu)', () => {
    for (const f of scanHistory(repo)) {
      const text = `${f.path} ${f.rule} ${f.line}`
      expect(text).not.toContain(CLIENT)
      expect(text).not.toContain(HEX)
      expect(text).not.toContain(IP)
      expect(EMAIL.test(text)).toBe(false)
      expect(f.line).toBe(0)
    }
  })
  it('control de l\'exclusió del lock: el diff del commit net sí que porta un correu, i amb --literal-pathspecs s\'escanejaria', () => {
    const net = hashes.get('net') ?? ''
    const literal = git(['--literal-pathspecs', '-c', 'core.quotePath=false', 'show', '--format=', '-p', net, '--', '.', ':(exclude,glob)**/pnpm-lock.yaml'])
    expect(scanForClientData([{ path: 'x', text: literal }]).map((f) => f.rule)).toContain('correu')
    const excluded = git(['-c', 'core.quotePath=false', 'show', '--format=', '-p', net, '--', '.', ':(exclude,glob)**/pnpm-lock.yaml'])
    expect(excluded).not.toContain('pnpm-lock.yaml')
    expect(excluded).toContain('README.md')
  })
  it('un clon superficial és una troballa', () => {
    expect(scanHistory(path.join(shallow, 'c'))).toEqual([{ line: 0, path: '(repositori)', rule: 'superficial' }])
  })
})
