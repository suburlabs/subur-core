import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseFacts } from '../../src/subur/facts.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APP = path.join(PKG, 'tests/fixtures/app')
const subur = (args: string[], env: NodeJS.ProcessEnv = process.env, cwd = APP) =>
  execFileSync(process.execPath, [path.join(PKG, 'bin/subur.js'), ...args], { cwd, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })
const empty = `subur_test_${process.pid}_bin`
const withDb = (url: string, name: string) => Object.assign(new URL(url), { pathname: `/${name}` }).toString()
const admin = () => withDb(process.env.DATABASE_URL!, 'postgres')
/** L'error d'una crida que ha de fallar: el codi de sortida i l'stderr. */
const failure = (args: string[], env: NodeJS.ProcessEnv = process.env, cwd = APP) => {
  try {
    subur(args, env, cwd)
  } catch (error) {
    const e = error as { status: number; stderr: string }
    return { status: e.status, stderr: e.stderr }
  }
  throw new Error(`subur ${args.join(' ')}: s'esperava que fallés`)
}
/** `subur gate …` sense `CI` (la guarda admetria `subur` a 127.0.0.1:5432): cap d'aquests casos no arriba a cap base ni a docker. */
const gate = (args: string[]) => {
  const { CI: _ci, ...env } = process.env
  const r = spawnSync(process.execPath, [path.join(PKG, 'bin/subur.js'), 'gate', ...args], { cwd: APP, encoding: 'utf8', env: env as NodeJS.ProcessEnv })
  return { status: r.status, stderr: r.stderr, stdout: r.stdout }
}
const sql = async (url: string, text: string) => { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return (await c.query(text)).rows } finally { await c.end() } }

// Cada crida al binari és un procés que carrega el motor (~2 s): el límit per defecte de 5 s no n'admet tres.
describe('binari subur', { timeout: 60_000 }, () => {
  beforeAll(async () => { await sql(admin(), `DROP DATABASE IF EXISTS "${empty}" WITH (FORCE)`); await sql(admin(), `CREATE DATABASE "${empty}"`) })
  const tmpApps: string[] = []
  afterAll(async () => {
    for (const db of [empty, `${empty}_absent`, `${empty}_args`]) await sql(admin(), `DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
    for (const dir of tmpApps) rmSync(dir, { force: true, recursive: true })
  })

  it('gate sense arguments surt 1 amb «falta --image» una sola vegada (la porta l\'imprimeix; el binari no el repeteix)', () => {
    const { status, stderr, stdout } = gate([])
    expect(status).toBe(1)
    expect(stderr.match(/falta --image/g)).toHaveLength(1)
    expect(stdout).not.toMatch(/falta --image/)
  })
  it('gate rebutja una base que no és de la porta abans de connectar-s\'hi, sense imprimir la contrasenya ni crear el directori de mitjans', () => {
    const scratch = mkdtempSync(path.join(os.tmpdir(), 'subur-gate-'))
    tmpApps.push(scratch)
    const media = path.join(scratch, 'media')
    // L'únic lloc on una prova cita la base `subur`: la guarda l'ha de rebutjar abans de cap connexió.
    const { status, stderr, stdout } = gate(['--image', 'x', '--media-dir', media, '--db-url', 'postgres://u:Zq9pw@127.0.0.1:5999/subur'])
    expect(status).toBe(1)
    expect(stderr).toMatch(/base no permesa/)
    expect(`${stdout}${stderr}`).not.toContain('Zq9pw')
    expect(existsSync(media)).toBe(false)
  })

  it('facts --json: una sola línia que parseFacts accepta, amb els fets del client de prova', () => {
    const out = subur(['facts', '--json'])
    expect(out.trim().split('\n')).toHaveLength(1)
    expect(parseFacts(out)).toMatchObject({ activeLocales: ['es'], defaultLocale: 'es', domain: 'fixture.example', id: 'fixture', posters: ['/site/hero/poster-1.webp', '/site/hero/poster-2.webp', '/site/hero/poster-3.webp', '/site/hero/poster-4.webp'], themeColor: { dark: '#101418', light: '#f6f6f4' }, url: 'https://fixture.example' })
  })
  it('facts --json amb .subur/ a limits.languages 2: dos idiomes en l\'ordre del seed', () => {
    const dir = mkdtempSync(path.join(PKG, 'tests/fixtures/.tmp-app-'))
    tmpApps.push(dir)
    cpSync(APP, dir, { recursive: true })
    cpSync(path.join(PKG, 'tests/fixtures/subur'), path.join(dir, '.subur'), { recursive: true })
    // El parser llegeix maxLanguages de modules.json (limits.languages), no de contract.json (src/subur/contract.ts; D12).
    const modules = JSON.parse(readFileSync(path.join(dir, '.subur/modules.json'), 'utf8')) as { limits: Record<string, number> }
    writeFileSync(path.join(dir, '.subur/modules.json'), JSON.stringify({ ...modules, limits: { ...modules.limits, languages: 2 } }))
    expect(parseFacts(subur(['facts', '--json'], process.env, dir)).activeLocales).toEqual(['es', 'ca'])
  })
  it('migrate --status i migrate sobre una base buida: sense onInit (C6, C12, C20)', async () => {
    const env = { ...process.env, DATABASE_URL: withDb(process.env.DATABASE_URL!, empty) }
    const before = subur(['migrate', '--status'], env)
    expect(before).toMatch(/^pendents: 11$/m)
    expect(before).not.toMatch(/WARN|INFO/)            // els registres del motor van a stderr (D14; sonda S8)
    subur(['migrate'], env)
    expect(subur(['migrate', '--status'], env)).toMatch(/^cap pendent$/m)
    expect(await sql(env.DATABASE_URL!, 'select count(*)::int as n from users')).toEqual([{ n: 0 }])
  })
  it('llegeix el .env del cwd i l\'entorn hi guanya (residu de C45 i C70; sondes S9 i S22)', () => {
    const dir = mkdtempSync(path.join(PKG, 'tests/fixtures/.tmp-app-'))
    tmpApps.push(dir)
    cpSync(APP, dir, { recursive: true })
    const good = withDb(process.env.DATABASE_URL!, empty)
    // environment.d.ts declara DATABASE_URL obligatòria; aquí falta a posta (rest as NodeJS.ProcessEnv).
    const { DATABASE_URL: _shell, ...rest } = process.env
    writeFileSync(path.join(dir, '.env'), `DATABASE_URL=${good}\n`)
    expect(subur(['migrate', '--status'], rest as NodeJS.ProcessEnv, dir)).toMatch(/^cap pendent$/m)                       // sense variable a l'entorn: la del fitxer
    writeFileSync(path.join(dir, '.env'), `DATABASE_URL=${withDb(good, `${empty}_absent`)}\n`)
    expect(subur(['migrate', '--status'], { ...rest, DATABASE_URL: good }, dir)).toMatch(/^cap pendent$/m)  // amb variable: la de l'entorn
  })
  it('migrate amb qualsevol argument que no sigui --status surt 2 sense tocar la base (ronda de revisió 1)', async () => {
    const db = `${empty}_args`
    await sql(admin(), `DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
    await sql(admin(), `CREATE DATABASE "${db}"`)
    const env = { ...process.env, DATABASE_URL: withDb(process.env.DATABASE_URL!, db) }
    for (const args of [['migrate', '--stats'], ['migrate', '--help'], ['migrate', '--status', '--dry-run']]) {
      const { status, stderr } = failure(args, env)
      expect(status, args.join(' ')).toBe(2)
      expect(stderr).toMatch(/subur migrate \[--status\]/)
    }
    expect(await sql(env.DATABASE_URL!, "select to_regclass('public.payload_migrations') as t")).toEqual([{ t: null }])
    expect(subur(['migrate', '--status'], env)).toMatch(/^pendents: 11$/m)
  })
  it('migrate --status sobre una base que no existeix surt 1 i no la crea (ronda de revisió 1)', async () => {
    const absent = `${empty}_absent`
    await sql(admin(), `DROP DATABASE IF EXISTS "${absent}" WITH (FORCE)`)
    const { status, stderr } = failure(['migrate', '--status'], { ...process.env, DATABASE_URL: withDb(process.env.DATABASE_URL!, absent) })
    expect(status).toBe(1)
    expect(stderr).toMatch(/la base de dades no existeix/)
    expect(await sql(admin(), `select datname from pg_database where datname = '${absent}'`)).toEqual([])
  })
  it('migrate sense DATABASE_URL (ni a l\'entorn ni al .env del cwd) surt 1 amb un missatge clar', () => {
    const { DATABASE_URL: _shell, ...rest } = process.env
    const { status, stderr } = failure(['migrate', '--status'], rest as NodeJS.ProcessEnv)
    expect(status).toBe(1)
    expect(stderr).toMatch(/falta DATABASE_URL/)
  })
  it('facts amb arguments de més surt 2', () => {
    expect(failure(['facts', '--json', '--extra']).status).toBe(2)
  })
  it('facts sense --json surt 2 amb l\'ús a stderr (nit de la ronda 3; sonda S37)', () => {
    try {
      subur(['facts'])
      expect.unreachable()
    } catch (error) {
      const e = error as { status: number; stderr: string }
      expect(e.status).toBe(2)
      expect(e.stderr).toMatch(/subur facts --json/)
    }
  })
  it('una ordre desconeguda surt 2 amb l\'ús a stderr', () => {
    try {
      subur(['nope'])
      expect.unreachable()
    } catch (error) {
      const e = error as { status: number; stderr: string }
      expect(e.status).toBe(2)
      expect(e.stderr).toMatch(/subur facts --json/)
    }
  })
})
