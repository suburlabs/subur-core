import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

import pg, { type QueryResultRow } from 'pg'

import type { Facts } from '../subur/facts.js'
import { gatePlan } from './plan.js'
import { redactLine } from './redact.js'

/**
 * Porta de la memòria cau amb la imatge real (spec §26.6). Arrenca la imatge
 * de `web` contra un Postgres ja migrat i sembrat, i comprova amb peticions de
 * debò (no amb dobles: la lliçó del pla K1) que la cau persistent fa el que
 * promet: escalfa, s'invalida en desar, sobreviu a un reinici i serveix
 * `STALE` amb el contingut vigent. Cada pas imprimeix `GATE <n> ok — …`; en
 * fallar, el pas, l'esperat, el rebut i la cua del registre del contenidor.
 *
 * Què prova (idiomes, camí principal, pòster) ho diuen els fets del client
 * (`gatePlan`); des del repositori del client:
 *
 *   subur gate --image <ref> --media-dir <dir>
 *     [--db-url <url>] [--base-url http://127.0.0.1:3000] [--docker-net host|bridge]
 *
 * La porta escriu a la base (subscripció, ajustos, el slug d'una pàgina): la
 * guarda només n'accepta una de dedicada. Cap cadena de connexió no s'imprimeix.
 */

const CONTAINER = 'gate'
const HEALTH_TIMEOUT_MS = 90_000
const TOMBSTONE_TIMEOUT_MS = 10_000
const PAGE_TIMEOUT_MS = 60_000
const GATE_DB = /^subur_gate(_\w+)?$/
const DOCKER_TIMEOUT_MS = 120_000
const DB_TIMEOUT_MS = 10_000

export class GateFailure extends Error {
  constructor(
    readonly step: number | string,
    readonly what: string,
    readonly expected: string,
    readonly received: string,
  ) {
    super(what)
  }
}

/** Les opcions de la porta: les de la línia d'ordres, el repositori del client (el seu `public/`) i els seus fets. */
export type GateOptions = {
  baseUrl: string
  dbUrl: string
  image: string
  mediaDir: string
  net: 'bridge' | 'host'
  repo: string
  facts: Facts
}

/** La porta ja ha imprès el motiu i la cua del registre: qui la crida només n'ha de propagar el codi de sortida. */
export class GateFailed extends Error {
  readonly exitCode = 1
  readonly reported = true
  constructor() {
    super('GATE falla')
  }
}

/**
 * La porta sembra i esborra: només una base `subur_gate[_…]`, o la del servei del CI. Exportada perquè qui prepara la
 * porta (l'acceptació del workspace) la pugui aplicar abans d'escriure res a la base (migracions, seed).
 */
export function assertGateDatabase(dbUrl: string): void {
  const url = new URL(dbUrl)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  const port = url.port || '5432'
  if (GATE_DB.test(name)) return
  if (
    process.env.CI === 'true' &&
    name === 'subur' &&
    url.hostname === '127.0.0.1' &&
    port === '5432'
  )
    return
  throw new GateFailure(
    'guarda',
    'base no permesa (la porta hi escriu)',
    'subur_gate o subur_gate_<nom>; o subur a 127.0.0.1:5432 amb CI=true',
    `${name} a ${url.hostname}:${port}`,
  )
}

/** En `bridge`, el contenidor arriba al Postgres del host per `host.docker.internal` (el host no resol aquest nom). */
function containerDbUrl(dbUrl: string, net: GateOptions['net']): string {
  if (net === 'host') return dbUrl
  const url = new URL(dbUrl)
  url.hostname = 'host.docker.internal'
  return url.toString()
}

function docker(args: string[], env?: NodeJS.ProcessEnv): { code: number; out: string } {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    env: env ?? process.env,
    maxBuffer: 16 * 1024 * 1024,
    // Cap ordre de `docker` no pot penjar la porta (ni la cua de `main`).
    timeout: DOCKER_TIMEOUT_MS,
  })
  const failed = result.error ? `\ndocker ${args[0]}: ${result.error.message}` : ''
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}${failed}` }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value)
    throw new GateFailure(
      'opcions',
      `falta ${name} a l'entorn`,
      `${name} definida (la mateixa que el seed)`,
      'buida',
    )
  return value
}

/**
 * Els valors arriben al contenidor per l'entorn del procés `docker` (`-e NOM`
 * sense valor): mai a la línia d'ordres ni al registre.
 */
function startContainer(opts: GateOptions): void {
  for (const name of ['SUBUR_SECRET', 'SUBUR_ADMIN_EMAIL', 'SUBUR_ADMIN_PASSWORD']) requireEnv(name)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: containerDbUrl(opts.dbUrl, opts.net),
    MEDIA_DIR: '/app/public/media',
    MEDIA_STORAGE: 'local',
    NEXT_PUBLIC_SERVER_URL: opts.baseUrl,
  }
  const port = new URL(opts.baseUrl).port || '3000'
  const network =
    opts.net === 'host'
      ? ['--network', 'host']
      : ['-p', `127.0.0.1:${port}:3000`, '--add-host', 'host.docker.internal:host-gateway']
  const passed = [
    'DATABASE_URL',
    'SUBUR_SECRET',
    'SUBUR_ADMIN_EMAIL',
    'SUBUR_ADMIN_PASSWORD',
    'CRON_SECRET',
    'PREVIEW_SECRET',
    'NEXT_PUBLIC_SERVER_URL',
    'MEDIA_STORAGE',
    'MEDIA_DIR',
  ].flatMap((name) => ['-e', name])
  docker(['rm', '-f', CONTAINER])
  const run = docker(
    [
      'run',
      '-d',
      '--name',
      CONTAINER,
      ...network,
      ...passed,
      '-v',
      `${opts.mediaDir}:/app/public/media`,
      opts.image,
    ],
    env,
  )
  if (run.code !== 0)
    throw new GateFailure(
      'arrencada',
      'docker run ha fallat',
      'el contenidor arrenca',
      redactLine(run.out.trim()),
    )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitHealth(base: string, step: number | string): Promise<number> {
  const started = Date.now()
  let last = 'cap resposta'
  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    const running = docker(['inspect', '-f', '{{.State.Running}}', CONTAINER]).out.trim()
    if (running !== 'true')
      throw new GateFailure(
        step,
        "el contenidor s'ha aturat",
        'en marxa',
        `State.Running=${running}`,
      )
    const response = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null)
    if (response?.status === 200) return Date.now() - started
    if (response) last = `HTTP ${response.status}`
    await sleep(1_000)
  }
  throw new GateFailure(
    step,
    `/api/health no respon 200 en ${HEALTH_TIMEOUT_MS / 1000} s`,
    'HTTP 200',
    last,
  )
}

type Got = { body: string; cache: string; status: number }

async function get(base: string, route: string): Promise<Got> {
  const response = await fetch(`${base}${route}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  })
  const body = await response.text()
  return { body, cache: response.headers.get('x-nextjs-cache') ?? '(cap)', status: response.status }
}

/** El que el peu diu del telèfon: l'evidència quan el valor esperat no hi és. */
const phonesIn = (body: string) =>
  [...new Set([...body.matchAll(/href="tel:([^"]*)"/g)].map((m) => m[1]))].join(', ') || 'cap'

async function run(opts: GateOptions): Promise<void> {
  assertGateDatabase(opts.dbUrl)
  const plan = gatePlan(opts.facts, opts.repo)
  const { locales, primary: L0, primaryPath } = plan
  const dbName = decodeURIComponent(new URL(opts.dbUrl).pathname.slice(1))
  console.log(`GATE · imatge ${opts.image}; base ${dbName}; web ${opts.baseUrl}; xarxa ${opts.net}`)

  const db = new pg.Client({
    connectionString: opts.dbUrl,
    connectionTimeoutMillis: DB_TIMEOUT_MS,
    query_timeout: DB_TIMEOUT_MS,
    statement_timeout: DB_TIMEOUT_MS,
  })
  await db.connect()
  let containerStarted = false
  try {
    const sql = async <T extends QueryResultRow>(text: string, params: unknown[] = []) =>
      (await db.query<T>(text, params)).rows
    /** Text, no `Date`: els microsegons de Postgres no es perden pel camí. */
    const now = async () => (await sql<{ t: string }>('select clock_timestamp()::text as t'))[0].t
    /** El hook escriu `'*'` a `waitUntil`, després de la resposta: cap `GET` abans que hi sigui. */
    const waitTombstone = async (since: string, step: number) => {
      const started = Date.now()
      while (Date.now() - started < TOMBSTONE_TIMEOUT_MS) {
        const rows = await sql<{ at: string }>(
          "select invalidated_at::text as at from next_cache_tags where tag = '*' and invalidated_at > $1::timestamptz",
          [since],
        )
        if (rows.length > 0) return rows[0].at
        await sleep(200)
      }
      throw new GateFailure(
        step,
        `la làpida '*' no ha arribat en ${TOMBSTONE_TIMEOUT_MS / 1000} s`,
        `invalidated_at > ${since}`,
        'cap fila posterior',
      )
    }
    const restart = async (step: number) => {
      const result = docker(['restart', CONTAINER])
      if (result.code !== 0)
        throw new GateFailure(
          step,
          'docker restart ha fallat',
          'codi 0',
          redactLine(result.out.trim()),
        )
      return waitHealth(opts.baseUrl, step)
    }
    const page = async (step: number, route: string) => {
      const got = await get(opts.baseUrl, route)
      if (got.status !== 200)
        throw new GateFailure(step, `GET ${route}`, 'HTTP 200', `HTTP ${got.status}`)
      return got
    }
    const ok = (step: number, evidence: string, started: number) =>
      console.log(`GATE ${step} ok — ${evidence} (${((Date.now() - started) / 1000).toFixed(1)} s)`)

    startContainer(opts)
    containerStarted = true
    const bootMs = await waitHealth(opts.baseUrl, 'arrencada')
    console.log(`GATE · /api/health 200 en ${(bootMs / 1000).toFixed(1)} s`)

    const login = await fetch(`${opts.baseUrl}/api/users/login`, {
      body: JSON.stringify({
        email: requireEnv('SUBUR_ADMIN_EMAIL'),
        password: requireEnv('SUBUR_ADMIN_PASSWORD'),
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    const { token } = (await login.json().catch(() => ({}))) as { token?: unknown }
    if (!login.ok || typeof token !== 'string') {
      throw new GateFailure(
        'login',
        'POST /api/users/login',
        'HTTP 200 amb token',
        `HTTP ${login.status}${typeof token === 'string' ? '' : ', sense token'}`,
      )
    }
    const auth = { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' }
    /** `POST` per als globals (el CMS no en té `PATCH`); `PATCH` per als documents. */
    const save = async (step: number, route: string, body: unknown, method: 'PATCH' | 'POST') => {
      const response = await fetch(`${opts.baseUrl}${route}`, {
        body: JSON.stringify(body),
        headers: auth,
        method,
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      })
      if (!response.ok) {
        const text = redactLine((await response.text().catch(() => '')).slice(0, 300))
        throw new GateFailure(
          step,
          `${method} ${route}`,
          'HTTP 2xx',
          `HTTP ${response.status} ${text}`,
        )
      }
      return (await response.json()) as Record<string, unknown>
    }
    const readJson = async (step: number, route: string) => {
      const response = await fetch(`${opts.baseUrl}${route}`, {
        headers: auth,
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      })
      if (!response.ok)
        throw new GateFailure(step, `GET ${route}`, 'HTTP 200', `HTTP ${response.status}`)
      return (await response.json()) as Record<string, unknown>
    }

    // 0. La imatge no porta `.subur/`: els idiomes actius del client s'activen per REST.
    let t = Date.now()
    const since0 = await now()
    await save(
      0,
      '/api/globals/subscription',
      { activeLocales: [...locales], maxLanguages: locales.length },
      'POST',
    )
    const star0 = await waitTombstone(since0, 0)
    ok(0, `subscripció ${locales.join(', ')}; làpida '*' ${star0}`, t)

    // 1. Escalfar els idiomes actius: el segon GET és un encert de la cau.
    t = Date.now()
    const warmed: string[] = []
    for (const locale of locales) {
      const first = await page(1, `/${locale}`)
      const second = await page(1, `/${locale}`)
      if (second.cache !== 'HIT')
        throw new GateFailure(
          1,
          `segon GET /${locale}`,
          'x-nextjs-cache: HIT',
          `${second.cache} (el primer: ${first.cache})`,
        )
      warmed.push(`/${locale} ${first.cache}→HIT`)
    }
    const [{ n: rows }] = await sql<{ n: string }>('select count(*)::text as n from next_cache')
    if (Number(rows) <= 0) throw new GateFailure(1, 'files a next_cache', '> 0', rows)
    ok(1, `${warmed.join(', ')}; next_cache: ${rows} files`, t)

    // 2. Desar un ajust no localitzat que surt al peu de totes les pàgines.
    t = Date.now()
    // Una sola base per als dos valors (pas 2 i pas 4): diferents per construcció.
    const stamp = String(Date.now()).slice(-7)
    const phone = `+34 600 ${stamp}0`
    const since = await now()
    await save(2, '/api/globals/site-settings', { phone }, 'POST')
    const star2 = await waitTombstone(since, 2)
    ok(2, `phone «${phone}» desat; làpida '*' ${star2}`, t)

    // 3. Un sol GET per idioma: el valor nou, renderitzat de nou.
    t = Date.now()
    for (const locale of locales) {
      const got = await page(3, `/${locale}`)
      if (!got.body.includes(phone) || got.cache !== 'MISS') {
        throw new GateFailure(
          3,
          `GET /${locale}`,
          `cos amb «${phone}» i MISS`,
          `${got.cache}; telèfons al cos: ${phonesIn(got.body)}`,
        )
      }
    }
    ok(3, `${locales.map((locale) => `/${locale}`).join(', ')}: MISS amb «${phone}»`, t)

    // 4. Desar i reiniciar sense cap GET pel mig (l'incident del 2026-09-24).
    t = Date.now()
    const phone2 = `+34 600 ${stamp}1`
    const since2 = await now()
    await save(4, '/api/globals/site-settings', { phone: phone2 }, 'POST')
    await waitTombstone(since2, 4)
    const restart4 = await restart(4)
    const after4: string[] = []
    for (const locale of locales) {
      const got = await page(4, `/${locale}`)
      if (!got.body.includes(phone2)) {
        throw new GateFailure(
          4,
          `primer GET /${locale} després del restart`,
          `cos amb «${phone2}»`,
          `${got.cache}; telèfons al cos: ${phonesIn(got.body)}`,
        )
      }
      after4.push(`/${locale} ${got.cache}`)
    }
    ok(
      4,
      `restart (salut en ${(restart4 / 1000).toFixed(1)} s); ${after4.join(', ')} amb «${phone2}»`,
      t,
    )

    // 5. Reinici amb la cau calenta: la còpia desada se serveix (STALE) i és la vigent.
    t = Date.now()
    await page(5, primaryPath)
    const warm5 = await page(5, primaryPath)
    if (warm5.cache !== 'HIT')
      throw new GateFailure(
        5,
        `segon GET ${primaryPath} abans del restart`,
        'x-nextjs-cache: HIT',
        warm5.cache,
      )
    const restart5 = await restart(5)
    const stale = await page(5, primaryPath)
    if (stale.cache !== 'STALE' || !stale.body.includes(phone2)) {
      throw new GateFailure(
        5,
        `primer GET ${primaryPath} després del restart`,
        `STALE amb «${phone2}»`,
        `${stale.cache}; telèfons al cos: ${phonesIn(stale.body)}`,
      )
    }
    ok(5, `restart (salut en ${(restart5 / 1000).toFixed(1)} s); ${primaryPath} STALE amb «${phone2}»`, t)

    // 6. Canviar el slug d'una pàgina del menú: una altra pàgina porta l'enllaç nou.
    t = Date.now()
    const header = await readJson(6, '/api/globals/header?depth=0')
    type NavItem = {
      link?: { reference?: { relationTo?: string; value?: unknown }; type?: string }
    }
    const referenced = ((header.navItems as NavItem[] | undefined) ?? [])
      .map((item) => item.link)
      .filter((link) => link?.type === 'reference' && link.reference?.relationTo === 'pages')
      .map((link) => link?.reference?.value)
      .filter(
        (value): value is number | string => typeof value === 'number' || typeof value === 'string',
      )
    if (referenced.length === 0)
      throw new GateFailure(
        6,
        'el seed no té cap enllaç de referència al menú',
        "un navItem amb type 'reference' a pages",
        'cap',
      )
    let target: { id: number | string; slug: string } | null = null
    for (const id of referenced) {
      const doc = await readJson(6, `/api/pages/${id}?depth=0&locale=${L0}`)
      if (typeof doc.slug === 'string' && doc.slug !== 'home') {
        target = { id, slug: doc.slug }
        break
      }
    }
    if (!target)
      throw new GateFailure(
        6,
        'tots els enllaços de referència del menú apunten a la portada',
        'una pàgina del menú que no sigui home',
        `ids ${referenced.join(', ')}`,
      )
    const newSlug = `gate-${String(Date.now()).slice(-8)}`
    const since3 = await now()
    await save(
      6,
      `/api/pages/${target.id}?locale=${L0}`,
      { _status: 'published', generateSlug: false, slug: newSlug },
      'PATCH',
    )
    await waitTombstone(since3, 6)
    const home = await page(6, primaryPath)
    const href = `href="/${L0}/${newSlug}"`
    if (!home.body.includes(href)) {
      const links =
        [...new Set([...home.body.matchAll(new RegExp(`href="(/${L0}/[^"]*)"`, 'g'))].map((m) => m[1]))].join(
          ', ',
        ) || 'cap'
      throw new GateFailure(
        6,
        `primer GET ${primaryPath} després del canvi de slug`,
        href,
        `${home.cache}; enllaços ${primaryPath}/ al cos: ${links}`,
      )
    }
    ok(6, `${target.slug} → ${newSlug}; ${primaryPath} (${home.cache}) porta ${href}`, t)

    // 7. La cau d'imatges de Next (al disc del contenidor) continua servint encerts.
    t = Date.now()
    if (!existsSync(plan.posterFile))
      throw new GateFailure(7, 'el pòster no és al repositori', `public${plan.poster}`, 'no existeix')
    const image1 = await get(opts.baseUrl, plan.imagePath)
    const image2 = await get(opts.baseUrl, plan.imagePath)
    if (image1.status !== 200 || image2.status !== 200 || image2.cache !== 'HIT') {
      throw new GateFailure(
        7,
        `GET ${plan.imagePath} dues vegades`,
        'HTTP 200 i la segona HIT',
        `HTTP ${image1.status} ${image1.cache}, HTTP ${image2.status} ${image2.cache}`,
      )
    }
    ok(7, `${plan.imagePath}: ${image1.cache}→HIT`, t)
    console.log('GATE passada')
  } catch (error) {
    // El motiu primer, i la cua del registre del contenidor just a sota (el `finally` corre abans de propagar).
    report(error)
    throw new GateFailed()
  } finally {
    await db.end().catch(() => undefined)
    if (containerStarted) {
      console.log(`GATE · docker logs --tail 50 ${CONTAINER}:`)
      const logs = docker(['logs', '--tail', '50', CONTAINER]).out
      for (const line of logs.split('\n')) console.log(`  ${redactLine(line)}`)
    }
    docker(['rm', '-f', CONTAINER])
  }
}

/** El motiu d'una fallada, al format de la porta: el pas, l'esperat i el rebut. */
export function report(error: unknown): void {
  if (error instanceof GateFailure) {
    console.error(`GATE ${error.step} FALLA — ${error.what}`)
    console.error(`  esperat: ${error.expected}`)
    console.error(`  rebut:   ${error.received}`)
  } else {
    console.error(
      `GATE FALLA — ${redactLine(error instanceof Error ? error.message : String(error))}`,
    )
  }
}

/**
 * La porta sobre un client: es resol si els passos 0–7 passen; si no, ha imprès el motiu (i, si el contenidor
 * ha arrencat, la cua del seu registre) i es rebutja amb `GateFailed`.
 */
export async function cacheGate(options: GateOptions): Promise<void> {
  try {
    await run(options)
  } catch (error) {
    if (error instanceof GateFailed) throw error
    // Abans del `try` de `run`: la guarda, el pla o la connexió a la base.
    report(error)
    throw new GateFailed()
  }
}
