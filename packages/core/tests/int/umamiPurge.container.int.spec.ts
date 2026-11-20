// Purga d'Umami a 25 mesos (spec §24.9) a la imatge real de `packages/core/backup`,
// sobre l'esquema que crea la imatge real d'Umami: corre si hi ha Docker; al CI,
// sempre (sense Docker hi falla, no s'omet).
import { execFileSync, spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const hasDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0
if (!hasDocker && process.env.CI) throw new Error('Docker és obligatori al CI per als tests de contenidor')
if (!hasDocker) console.warn('umamiPurge.container: sense Docker (`docker info` falla), els tests de contenidor s’ometen')
const suite = hasDocker ? describe : describe.skip

/** Amb `SUBUR_BACKUP_IMAGE` (referència per digest), les proves corren la imatge publicada i no en construeixen cap (pla E3b, R8). */
const PUBLISHED = process.env.SUBUR_BACKUP_IMAGE
const IMAGE = PUBLISHED ?? 'subur-backup-test'
/** La imatge publicada només és `linux/amd64`: en una màquina `arm64` corre emulada, més a poc a poc. */
const PLATFORM = PUBLISHED ? ['--platform', 'linux/amd64'] : []
const SLOW = PUBLISHED ? 3 : 1

const UMAMI_IMAGE = 'ghcr.io/umami-software/umami:postgresql-v2.20.2'
const WEBSITE = '00000000-0000-4000-8000-000000000001'
const OLD_SESSION = '00000000-0000-4000-8000-0000000000a1'
const NEW_SESSION = '00000000-0000-4000-8000-0000000000b1'
// Vella però amb un esdeveniment recent: ha de sobreviure (la guarda de la segona sentència).
const MIXED_SESSION = '00000000-0000-4000-8000-0000000000f1'

suite('umami-purge.sh (contenidor real)', () => {
  const net = `subur-up-${process.pid}`
  const pg = `subur-up-pg-${process.pid}`
  const um = `subur-up-um-${process.pid}`
  const url = `postgresql://postgres:t@${pg}:5432/umami`
  let imageId: string
  const psql = (sql: string) => docker('exec', pg, 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-d', 'umami', '-tA', '-c', sql).trim()
  const purge = (env: Record<string, string> = {}) => {
    const envArgs = Object.entries({ DATABASE_URL: url, ...env }).flatMap(([k, v]) => ['-e', `${k}=${v}`])
    const r = spawnSync('docker', ['run', '--rm', ...PLATFORM, '--network', net, ...envArgs, IMAGE, 'umami-purge.sh'], { encoding: 'utf8' })
    return { code: r.status, out: `${r.stdout}${r.stderr}` }
  }

  beforeAll(() => {
    if (PUBLISHED) {
      docker('pull', '--platform', 'linux/amd64', PUBLISHED)
      docker('tag', PUBLISHED, 'subur-backup-test')
      imageId = docker('inspect', '--format', '{{.Id}}', PUBLISHED).trim()
    } else {
      docker('build', '-q', '-t', 'subur-backup-test', 'backup')
    }
    docker('network', 'create', net)
    docker('run', '-d', '--name', pg, '--network', net, '-e', 'POSTGRES_PASSWORD=t', 'postgres:17-alpine')
    // Per TCP: durant la inicialització la imatge reinicia el servidor després d'un de temporal al sòcol.
    const ready = () => spawnSync('docker', ['exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0
    for (let i = 0; i < 60 && !ready(); i++) execFileSync('sleep', ['1'])
    if (!ready()) throw new Error('el Postgres de prova no arrenca')
    docker('exec', pg, 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-c', 'create database umami')
    // Umami aplica les seves migracions en arrencar: quan el heartbeat respon, l'esquema hi és.
    docker('run', '-d', '--name', um, '--network', net, '-e', `DATABASE_URL=${url}`, '-e', 'APP_SECRET=test', UMAMI_IMAGE)
    const up = () => spawnSync('docker', ['exec', um, 'wget', '-qO-', 'http://127.0.0.1:3000/api/heartbeat'], { stdio: 'ignore' }).status === 0
    for (let i = 0; i < 120 && !up(); i++) execFileSync('sleep', ['2'])
    if (!up()) throw new Error('Umami no arrenca')
    psql(`insert into website (website_id, name, domain) values ('${WEBSITE}', 'prova', 'example.test')`)
    // Sessió vella (30 mesos): dos esdeveniments i un event_data. Sessió recent (2 mesos): un esdeveniment.
    psql(`insert into session (session_id, website_id, created_at) values
      ('${OLD_SESSION}', '${WEBSITE}', now() - interval '30 months'),
      ('${NEW_SESSION}', '${WEBSITE}', now() - interval '2 months'),
      ('${MIXED_SESSION}', '${WEBSITE}', now() - interval '30 months')`)
    psql(`insert into website_event (event_id, website_id, session_id, visit_id, url_path, created_at) values
      ('00000000-0000-4000-8000-0000000000c1', '${WEBSITE}', '${OLD_SESSION}', '${OLD_SESSION}', '/', now() - interval '30 months'),
      ('00000000-0000-4000-8000-0000000000c2', '${WEBSITE}', '${OLD_SESSION}', '${OLD_SESSION}', '/a', now() - interval '30 months'),
      ('00000000-0000-4000-8000-0000000000d1', '${WEBSITE}', '${NEW_SESSION}', '${NEW_SESSION}', '/', now() - interval '2 months'),
      ('00000000-0000-4000-8000-0000000000c3', '${WEBSITE}', '${MIXED_SESSION}', '${MIXED_SESSION}', '/old', now() - interval '30 months'),
      ('00000000-0000-4000-8000-0000000000d2', '${WEBSITE}', '${MIXED_SESSION}', '${MIXED_SESSION}', '/new', now() - interval '1 month')`)
    psql(`insert into event_data (event_data_id, website_id, website_event_id, data_key, data_type, created_at) values
      ('00000000-0000-4000-8000-0000000000e1', '${WEBSITE}', '00000000-0000-4000-8000-0000000000c1', 'k', 1, now() - interval '30 months')`)
  }, 300_000 * SLOW)
  afterAll(() => {
    spawnSync('docker', ['rm', '-f', um, pg], { stdio: 'ignore' })
    spawnSync('docker', ['network', 'rm', net], { stdio: 'ignore' })
  })

  it.runIf(PUBLISHED)('el que corre és la imatge publicada: l etiqueta local subur-backup-test té l ID de la publicada', () => {
    // Un literal 'subur-backup-test' oblidat ha de córrer aquesta mateixa imatge (backup.container també fa servir l'etiqueta).
    expect(docker('image', 'inspect', 'subur-backup-test', '--format', '{{.Id}}').trim()).toBe(imageId)
  })

  it('un valor no válido de UMAMI_PURGE_MONTHS falla sin tocar nada', () => {
    for (const bad of ['abc', '0', '00', '-3', '2 months']) {
      const r = purge({ UMAMI_PURGE_MONTHS: bad })
      expect(r.code).toBe(1)
      expect(r.out).toMatch(/UMAMI_PURGE_MONTHS no válido/)
    }
    expect(psql('select count(*) from website_event')).toBe('5')
    expect(psql('select count(*) from session')).toBe('3')
  }, 120_000 * SLOW)

  it('borra lo viejo (incluida la sesión sin eventos) y deja lo reciente; el registro solo lleva recuentos', () => {
    const r = purge()
    expect(r.code).toBe(0)
    expect(r.out.trim()).toBe('Purga Umami: event_data=1 website_event=3 session_data=0 session=1')
    expect(psql('select session_id from session order by session_id')).toBe(`${NEW_SESSION}\n${MIXED_SESSION}`)
    expect(psql('select event_id from website_event order by event_id')).toBe('00000000-0000-4000-8000-0000000000d1\n00000000-0000-4000-8000-0000000000d2')
    expect(psql('select count(*) from event_data')).toBe('0')
    expect(r.out).not.toContain(OLD_SESSION)
    // Segunda pasada: nada que borrar.
    expect(purge().out.trim()).toBe('Purga Umami: event_data=0 website_event=0 session_data=0 session=0')
  }, 120_000 * SLOW)
})
