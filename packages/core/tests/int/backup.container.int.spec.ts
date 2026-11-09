// Còpies per cadència i retenció de l'entorn (spec §25.4) a la imatge real de `packages/core/backup`: corre si hi
// ha Docker; al CI, sempre (sense Docker hi falla, no s'omet).
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const hasDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0
if (!hasDocker && process.env.CI) throw new Error('Docker és obligatori al CI per als tests de contenidor')
if (!hasDocker) console.warn('backup.container: sense Docker (`docker info` falla), els tests de contenidor s’ometen')
const suite = hasDocker ? describe : describe.skip

/** Amb `SUBUR_BACKUP_IMAGE` (referència per digest), les proves corren la imatge publicada i no en construeixen cap (pla E3b, R8). */
const PUBLISHED = process.env.SUBUR_BACKUP_IMAGE
const IMAGE = PUBLISHED ?? 'subur-backup-test'
/** La imatge publicada només és `linux/amd64`: en una màquina `arm64` corre emulada, més a poc a poc. */
const PLATFORM = PUBLISHED ? ['--platform', 'linux/amd64'] : []
const SLOW = PUBLISHED ? 3 : 1

suite('backup.sh --scheduled (contenidor real)', () => {
  const net = `subur-bt-${process.pid}`
  const pg = `subur-bt-pg-${process.pid}`
  let data: string
  let hooks: string
  let imageId: string
  beforeAll(() => {
    if (PUBLISHED) {
      docker('pull', '--platform', 'linux/amd64', PUBLISHED)
      docker('tag', PUBLISHED, 'subur-backup-test')
      imageId = docker('inspect', '--format', '{{.Id}}', PUBLISHED).trim()
    } else {
      imageId = docker('build', '-q', '--build-arg', `VERSION=${readFileSync('backup/VERSION', 'utf8').trim()}`, '-t', 'subur-backup-test', 'backup').trim()
    }
    docker('network', 'create', net)
    docker('run', '-d', '--name', pg, '--network', net, '-e', 'POSTGRES_PASSWORD=t', 'postgres:17-alpine')
    // Per TCP i no pel sòcol: durant la inicialització la imatge aixeca un
    // servidor temporal només al sòcol i el reinicia després (un `pg_isready`
    // pel sòcol diu «a punt» massa d'hora i el `psql` següent troba la porta tancada).
    const ready = () => spawnSync('docker', ['exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0
    for (let i = 0; i < 60 && !ready(); i++) execFileSync('sleep', ['1'])
    if (!ready()) throw new Error('el Postgres de prova no arrenca')
    data = mkdtempSync(path.join(tmpdir(), 'subur-bt-'))
    // La tasca posterior de prova (BACKUP_POST_HOOK): només deixa constància que ha corregut.
    hooks = mkdtempSync(path.join(tmpdir(), 'subur-bt-hook-'))
    writeFileSync(path.join(hooks, 'test-hook.sh'), '#!/bin/sh\necho "Tarea posterior: corre"\n')
    chmodSync(path.join(hooks, 'test-hook.sh'), 0o755)
  }, 180_000 * SLOW)
  afterAll(() => {
    spawnSync('docker', ['rm', '-f', pg], { stdio: 'ignore' })
    spawnSync('docker', ['network', 'rm', net], { stdio: 'ignore' })
    rmSync(data, { force: true, recursive: true })
    rmSync(hooks, { force: true, recursive: true })
  })

  it('la imatge porta les etiquetes de versió (backup/VERSION) i d’origen', () => {
    // Pel seu ID i no per l'etiqueta: `umamiPurge.container` reetiqueta `subur-backup-test` sense `--build-arg` (sense `SUBUR_BACKUP_IMAGE`) i una sessió concurrent podria fer-ho entremig.
    const label = docker('inspect', '--type', 'image', imageId, '--format', '{{index .Config.Labels "org.opencontainers.image.version"}}')
    expect(label.trim()).toBe(readFileSync('backup/VERSION', 'utf8').trim())
    expect(docker('inspect', '--type', 'image', imageId, '--format', '{{index .Config.Labels "org.opencontainers.image.source"}}').trim()).toBe('https://github.com/suburlabs/subur-core')
  })

  it.runIf(PUBLISHED)('el que corre és la imatge publicada: l etiqueta local subur-backup-test té l ID de la publicada', () => {
    // Un literal 'subur-backup-test' oblidat ha de córrer aquesta mateixa imatge (umamiPurge.container també fa servir l'etiqueta).
    expect(docker('image', 'inspect', 'subur-backup-test', '--format', '{{.Id}}').trim()).toBe(imageId)
  })

  // Dues còpies dins del mateix segon comparteixen marca i la segona s'atura
  // («Ya existe una copia…», a posta): cada execució comença en un segon nou.
  let last = 0
  const user = `${userInfo().uid}:${userInfo().gid}`
  const nextSecond = () => {
    const wait = (Math.floor(last / 1000) + 1) * 1000 + 100 - Date.now()
    if (wait > 0) execFileSync('sleep', [(wait / 1000).toFixed(3)])
  }
  const run = (env: Record<string, string>, ...args: string[]) => {
    nextSecond()
    const envArgs = Object.entries({ BACKUP_EVERY: 'monthly', BACKUP_KEEP: '3', BACKUP_SKIP_MEDIA: '1', BACKUP_TARGET: '/data', DATABASE_URL: `postgres://postgres:t@${pg}:5432/postgres`, ...env }).flatMap(([k, v]) => ['-e', `${k}=${v}`])
    const hook = ['-v', `${path.join(hooks, 'test-hook.sh')}:/usr/local/bin/test-hook.sh:ro`]
    // Amb l'usuari del test: a Linux, com a root, `db/` i les còpies del muntatge serien de root
    // i el test no les podria esborrar ni escriure-hi (Docker Desktop per a Mac ho amaga).
    const r = spawnSync('docker', ['run', '--rm', ...PLATFORM, '--user', user, '--network', net, '-v', `${data}:/data`, ...hook, ...envArgs, IMAGE, 'backup.sh', ...args], { encoding: 'utf8' })
    last = Date.now()
    return { code: r.status, out: `${r.stdout}${r.stderr}` }
  }
  // Abans de la primera còpia no hi ha `db/`.
  const listed = (ext: string) => (existsSync(path.join(data, 'db')) ? readdirSync(path.join(data, 'db')).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort() : [])
  const dumps = () => listed('.ok').length
  /** Les còpies acabades de cada cua: les manuals porten `db/<MARCA>.manual` al costat del `.ok`. */
  const queues = () => {
    const manual = listed('.manual')
    return { manual: listed('.ok').filter((s) => manual.includes(s)), scheduled: listed('.ok').filter((s) => !manual.includes(s)) }
  }
  const stampOf = (out: string) => {
    const match = /Copia (\d{8}T\d{6}Z) hecha/.exec(out)
    if (!match) throw new Error(`backup.sh no ha fet cap còpia:\n${out}`)
    return match[1]
  }

  it('BACKUP_EVERY=monthly: només el dia 01 programat; manual sempre; el heartbeat diu la cadència', () => {
    const skipped = run({ BACKUP_DAY: '15', BACKUP_HEARTBEAT_URL: 'http://127.0.0.1:9/hb/x' }, '--scheduled')
    expect(skipped.code).toBe(0)
    expect(skipped.out).toMatch(/Hoy no toca copia \(plan mensual\)/)
    // Cap còpia intentada, cap latido.
    expect(skipped.out).not.toMatch(/Latido/)
    expect(dumps()).toBe(0)
    const first = run({ BACKUP_DAY: '01', BACKUP_HEARTBEAT_URL: 'http://127.0.0.1:9/hb/x' }, '--scheduled')
    expect(first.code).toBe(0)
    expect(first.out).toMatch(/Copia \d{8}T\d{6}Z hecha/)
    expect(first.out).toMatch(/Latido: status=ok stamp=\d{8}T\d{6}Z every=monthly/)
    expect(first.out).not.toMatch(/127\.0\.0\.1:9/)
    expect(first.out).not.toMatch(/hb\/x/)
    expect(run({ BACKUP_DAY: '15' }).out).toMatch(/hecha/)
    expect(dumps()).toBe(2)
  }, 120_000 * SLOW)

  it('sense BACKUP_EVERY surt amb error i no fa cap còpia (cap desplegament sense valors de còpia)', () => {
    const before = dumps()
    const r = run({ BACKUP_EVERY: '', BACKUP_HEARTBEAT_URL: 'http://127.0.0.1:9/hb/x' }, '--scheduled')
    expect(r.code).not.toBe(0)
    expect(r.out).toMatch(/falta BACKUP_EVERY/)
    expect(r.out).not.toMatch(/hecha/)
    expect(dumps()).toBe(before)
  }, 30_000 * SLOW)

  it('sense BACKUP_KEEP surt amb error (la retenció és contractual, no té valor per defecte)', () => {
    const r = run({ BACKUP_EVERY: 'daily', BACKUP_KEEP: '' }, '--scheduled')
    expect(r.code).not.toBe(0)
    expect(r.out).toMatch(/falta BACKUP_KEEP/)
  }, 30_000 * SLOW)

  it('BACKUP_EVERY=daily copia cada dia i BACKUP_KEEP mana a la cua de les programades; valors invàlids fallen', () => {
    const r = run({ BACKUP_DAY: '15', BACKUP_EVERY: 'daily', BACKUP_HEARTBEAT_URL: 'http://127.0.0.1:9/hb/x', BACKUP_KEEP: '2' }, '--scheduled')
    expect(r.out).toMatch(/hecha/)
    expect(r.out).toMatch(/every=daily/)
    // Dues programades més, amb KEEP=2: en queden 2; la manual del primer test no compta.
    run({ BACKUP_DAY: '15', BACKUP_EVERY: 'daily', BACKUP_KEEP: '2' }, '--scheduled')
    const third = run({ BACKUP_DAY: '15', BACKUP_EVERY: 'daily', BACKUP_KEEP: '2' }, '--scheduled')
    expect(third.out).toMatch(/retirada/)
    expect(queues().scheduled).toHaveLength(2)
    expect(queues().manual).toHaveLength(1)
    const bad = run({ BACKUP_EVERY: 'hourly' }, '--scheduled')
    expect(bad.code).toBe(1)
    expect(bad.out).toMatch(/BACKUP_EVERY no válido/)
    for (const keep of ['0', 'x']) expect(run({ BACKUP_KEEP: keep }, '--scheduled').out).toMatch(/BACKUP_KEEP no válido/)
  }, 180_000 * SLOW)

  it('dues cues: les manuals en conserven 3 sempre, les programades BACKUP_KEEP; cap no retira de l’altra', () => {
    rmSync(path.join(data, 'db'), { force: true, recursive: true })
    const manuals = [0, 1, 2].map(() => stampOf(run({}).out))
    expect(queues()).toEqual({ manual: manuals, scheduled: [] })
    const scheduled = stampOf(run({ BACKUP_DAY: '01' }, '--scheduled').out)
    // 3 manuals + 1 programada amb KEEP=3: no es retira res.
    expect(queues()).toEqual({ manual: manuals, scheduled: [scheduled] })
    // Una 4a manual retira la manual més vella i cap programada, encara que BACKUP_KEEP digui una altra cosa.
    const fourth = run({ BACKUP_KEEP: '1' })
    expect(fourth.out).toMatch(new RegExp(`Copia ${manuals[0]} retirada`))
    expect(queues()).toEqual({ manual: [...manuals.slice(1), stampOf(fourth.out)], scheduled: [scheduled] })
    expect(existsSync(path.join(data, 'db', `${manuals[0]}.manual`))).toBe(false)
    // 4 programades amb KEEP=3: en queden 3 (la més vella fora) i totes les manuals.
    const more = [0, 1, 2].map(() => stampOf(run({ BACKUP_DAY: '01' }, '--scheduled').out))
    expect(queues()).toEqual({ manual: [...manuals.slice(1), stampOf(fourth.out)], scheduled: more })
    // La còpia del traspàs (`-e BACKUP_KEEP=99`) és una manual més: tampoc toca les programades.
    run({ BACKUP_KEEP: '99' })
    expect(queues().scheduled).toEqual(more)
    expect(queues().manual).toHaveLength(3)
    // Una manual interrompuda (volcat i `.manual`, sense `.ok`) se'n va sencera amb la neteja d'orfes.
    writeFileSync(path.join(data, 'db', '20200101T000000Z.dump'), 'x')
    writeFileSync(path.join(data, 'db', '20200101T000000Z.manual'), '20200101T000000Z\n')
    expect(run({}).out).toMatch(/Copia 20200101T000000Z \(interrumpida\) retirada/)
    expect(readdirSync(path.join(data, 'db')).filter((f) => f.startsWith('20200101T000000Z'))).toEqual([])
  }, 240_000 * SLOW)

  it('BACKUP_POST_HOOK corre només després d’una còpia programada bona', () => {
    const hook = { BACKUP_POST_HOOK: 'test-hook.sh' }
    // mensual, dia 15: no toca, no hi ha tasca posterior.
    expect(run({ ...hook, BACKUP_DAY: '15' }, '--scheduled').out).not.toMatch(/Tarea posterior/)
    // Manual: tampoc.
    const manual = run(hook)
    expect(manual.out).toMatch(/hecha/)
    expect(manual.out).not.toMatch(/Tarea posterior/)
    // Programada i feta: sí.
    const done = run({ ...hook, BACKUP_DAY: '01' }, '--scheduled')
    expect(done.code).toBe(0)
    expect(done.out).toMatch(/hecha[\s\S]*Tarea posterior: corre/)
  }, 120_000 * SLOW)

  it('la imatge no porta plan-policy.sh, ni psql cap a subscription, ni «según plan» a l’entrypoint', () => {
    expect(spawnSync('docker', ['run', '--rm', ...PLATFORM, '--entrypoint', 'sh', IMAGE, '-c', '! grep -q "según plan" /usr/local/bin/entrypoint.sh']).status).toBe(0)
    const start = spawnSync('docker', ['run', '--rm', ...PLATFORM, '--entrypoint', 'entrypoint.sh', IMAGE], { encoding: 'utf8' })
    expect(start.status).not.toBe(0)
    expect(`${start.stdout}${start.stderr}`).toMatch(/falta BACKUP_EVERY/)
    expect(spawnSync('docker', ['run', '--rm', ...PLATFORM, '--entrypoint', 'sh', IMAGE, '-c', 'test ! -e /usr/local/bin/plan-policy.sh && ! grep -q "from subscription" /usr/local/bin/backup.sh']).status).toBe(0)
  }, 30_000 * SLOW)

  it('el volcat porta l’esquema de la memòria cau de Next però cap dada (spec §26.3)', () => {
    const psql = ['exec', pg, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c']
    docker(...psql, "create table next_cache(key text primary key, payload text); create table next_cache_tags(tag text primary key); insert into next_cache values ('k','v'); insert into next_cache_tags values ('t')")
    try {
      const stamp = stampOf(run({}).out)
      const listing = docker('run', '--rm', ...PLATFORM, '-v', `${data}:/data`, IMAGE, 'pg_restore', '-l', `/data/db/${stamp}.dump`)
      expect(listing).toMatch(/TABLE public next_cache /)
      expect(listing).toMatch(/TABLE public next_cache_tags /)
      expect(listing).not.toMatch(/TABLE DATA public next_cache/)
    } finally {
      // Al `finally`: una asserció que falla no pot deixar les taules al contenidor compartit.
      docker(...psql, 'drop table if exists next_cache, next_cache_tags')
    }
  }, 120_000 * SLOW)

  it('setmanal: només diumenge (dia UTC d’avui)', () => {
    const sunday = new Date().getUTCDay() === 0
    const r = run({ BACKUP_EVERY: 'weekly', BACKUP_KEEP: '8' }, '--scheduled')
    expect(r.code).toBe(0)
    expect(r.out).toMatch(sunday ? /hecha/ : /Hoy no toca copia \(plan semanal\)/)
  }, 120_000 * SLOW)

  it('ida i tornada: backup.sh manual i restore.sh <marca> --force sobre una base buida tornen la fila marcada (pla E3b, R8)', () => {
    const sql = (db: string, query: string) => docker('exec', pg, 'psql', '-U', 'postgres', '-d', db, '-tA', '-v', 'ON_ERROR_STOP=1', '-c', query).trim()
    sql('postgres', "create table e3b_marker(id int primary key, note text); insert into e3b_marker values (1, 'assaig E3b')")
    try {
      const stamp = stampOf(run({}).out)
      sql('postgres', 'create database e3b_restore')
      const envArgs = Object.entries({ BACKUP_SKIP_MEDIA: '1', BACKUP_TARGET: '/data', DATABASE_URL: `postgres://postgres:t@${pg}:5432/e3b_restore` }).flatMap(([k, v]) => ['-e', `${k}=${v}`])
      const r = spawnSync('docker', ['run', '--rm', ...PLATFORM, '--user', user, '--network', net, '-v', `${data}:/data`, ...envArgs, IMAGE, 'restore.sh', stamp, '--force'], { encoding: 'utf8' })
      expect(r.status, `${r.stdout}${r.stderr}`).toBe(0)
      expect(r.stdout).toContain(`Copia ${stamp} restaurada (base de datos)`)
      expect(sql('e3b_restore', 'select note from e3b_marker where id = 1')).toBe('assaig E3b')
    } finally {
      // Al `finally`: una asserció que falla no pot deixar res al Postgres compartit.
      sql('postgres', 'drop table if exists e3b_marker')
      sql('postgres', 'drop database if exists e3b_restore')
    }
  }, 180_000 * SLOW)
})
