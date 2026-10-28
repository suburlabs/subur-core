// L'acceptació d'E1 i E2 (spec §1 criteri 1, §10): una app fora del repositori, creada per `create-subur-app` des del seu
// tarball (el `files` publicat) i instal·lada des del tarball de `pnpm pack` del nucli, la seva imatge Docker, el panell amb
// sessió dins del contenidor i la porta de la cau contra aquella imatge. Cada pas imprimeix `ACCEPT <n> ok — …`; qualsevol
// fallada surt amb codi diferent de 0.
import { execFileSync, type ExecFileSyncOptions, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'

// La guarda de la base, la redacció del registre i la llista de .pnpmfile són les del nucli, des de la font del paquet: aquí
// el paquet encara no s'ha construït (pas 1).
import { assertGateDatabase, redactLine } from '../../packages/core/src/gate/index.js'
import { PNPMFILES } from '../../packages/core/src/templates/files.js'
import { viewProblem } from './viewProblem.js'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO = path.join(CORE, 'examples/demo')
const CLI_PKG = path.join(CORE, 'packages/create-subur-app')
// `--keep-app-files` es retira (desviació 19 del pla E2): la CLI exigeix un directori inexistent o buit.
const { values } = parseArgs({
  options: {
    app: { type: 'string' },
    'db-url': { type: 'string' },
    'docker-net': { default: process.env.CI === 'true' ? 'host' : 'bridge', type: 'string' },
    keep: { default: false, type: 'boolean' },
    'prepare-only': { default: false, type: 'boolean' },
    tarball: { type: 'string' },
  },
})
const sh = (cmd: string, args: string[], opts: ExecFileSyncOptions = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const ok = (n: number, what: string) => console.log(`ACCEPT ${n} ok — ${what}`)
function fail(what: string): never {
  console.error(`ACCEPT FALLA — ${what}`)
  process.exit(1)
}
/** Una ordre de l'app amb la sortida capturada (i reimpresa): codi diferent de 0 → ACCEPT FALLA amb l'ordre. */
function capture(cmd: string, args: string[], cwd: string): string {
  const { error, status, stdout } = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  if (stdout) process.stdout.write(stdout)
  if (error || status !== 0) fail(`${cmd} ${args.join(' ')} (a ${cwd}): ${error?.message ?? `codi ${status}`}`)
  return stdout
}
const net = values['docker-net']
if (net !== 'host' && net !== 'bridge') fail(`--docker-net ha de ser host o bridge: ${net}`)

// Abans de cap escriptura (build, migracions, seed, imatge): la base ha de ser una de la porta i l'entorn, el del contenidor.
const dbUrl = values['db-url'] ?? process.env.DATABASE_URL ?? ''
if (!values['prepare-only']) {
  if (!dbUrl) fail('falta --db-url o DATABASE_URL (subur_gate_* en local; la del servei al CI)')
  try {
    assertGateDatabase(dbUrl)
  } catch (error) {
    const { expected, message, received } = error as { expected?: string; message: string; received?: string }
    fail(`${message}; esperat: ${expected ?? '?'}; rebut: ${received ?? '?'}`)
  }
  for (const key of ['SUBUR_SECRET', 'SUBUR_ADMIN_EMAIL', 'SUBUR_ADMIN_PASSWORD']) if (!process.env[key]) fail(`falta ${key} a l'entorn (la fan servir el seed, el contenidor i la porta)`)
}

const IMAGE = 'subur-demo:acceptance'
const BASE = 'http://127.0.0.1:3000'
const TARBALL = /^suburlabs-core-(\d+\.\d+\.\d+)\.tgz$/
const CLI_TARBALL = /^create-subur-app-(\d+\.\d+\.\d+)\.tgz$/
const NAME = 'Reformes Exemple'

// 1. els tarballs (el del nucli, del paquet construït o el que es passa; el de la CLI, sempre del paquet construït) a
// <app>.vendor/, germà de l'app: l'app l'ha de crear la CLI (directori inexistent o buit). <app>.vendor/ es buida abans (una
// passada nova no pot heretar els d'una altra).
const app = path.resolve(values.app ?? mkdtempSync(path.join(tmpdir(), 'subur-acceptance-')))
const vendorDir = `${app}.vendor`
// Fora del repositori sencer, no només de core/: dins, Node i pnpm trobarien node_modules i configuració de més amunt.
const repo = realpathSync(execFileSync('git', ['-C', CORE, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim())
const insideRepo = (real: string) => `${real}${path.sep}`.startsWith(`${repo}${path.sep}`)
// --app pot ser un directori que encara no existeix i realpath el vol creat (D22, D64; sonda S12): abans de crear
// res, el camí real de l'avantpassat més proper que existeix més la resta; un --app dins del repositori falla sense deixar-hi
// cap directori (mutació A1b de l'onada final). El control s'estén al pare: <app>.vendor/ hi viu.
const realPending = (target: string): string => (existsSync(target) ? realpathSync(target) : path.join(realPending(path.dirname(target)), path.basename(target)))
for (const dir of [path.dirname(app), app]) if (insideRepo(realPending(dir))) fail(`l'app i ${path.basename(vendorDir)}/ han de ser fora del repositori: ${dir}`)
// Abans del build: la CLI ho exigeix igualment, però després de minuts de build i pack.
if (existsSync(app) && (!statSync(app).isDirectory() || readdirSync(app).length > 0)) fail(`--app ha de ser un directori inexistent o buit (la CLI ho exigeix): ${app}`)
// Només es buida un <app>.vendor/ d'una passada anterior (tarballs i cli/): mai un directori aliè amb el mateix nom.
if (existsSync(vendorDir)) {
  const foreign = statSync(vendorDir).isDirectory()
    ? readdirSync(vendorDir).filter((f) => !(f.endsWith('.tgz') && statSync(path.join(vendorDir, f)).isFile()) && !(f === 'cli' && statSync(path.join(vendorDir, f)).isDirectory()))
    : ['(no és un directori)']
  if (foreign.length > 0) fail(`${vendorDir} existeix i no és d'una passada anterior (només hi caben *.tgz i cli/): ${foreign.join(', ')}`)
}
rmSync(vendorDir, { force: true, recursive: true })
mkdirSync(vendorDir, { recursive: true })
let tgz: string
if (values.tarball) {
  tgz = path.basename(values.tarball)
  if (!TARBALL.test(tgz)) fail(`--tarball ha de ser un suburlabs-core-x.y.z.tgz (sense sufix de prerelease, com a --core-tarball de la CLI): ${tgz}`)
  copyFileSync(values.tarball, path.join(vendorDir, tgz))
  sh('pnpm', ['-C', CLI_PKG, 'build'])
} else {
  sh('pnpm', ['-C', CORE, 'build'])
  sh('pnpm', ['-C', path.join(CORE, 'packages/core'), 'pack', '--pack-destination', vendorDir])
  const packed = readdirSync(vendorDir).filter((f) => TARBALL.test(f))
  if (packed.length !== 1) fail(`pnpm pack ha d'escriure exactament un suburlabs-core-x.y.z.tgz (sense sufix de prerelease) a ${vendorDir}; hi ha: ${readdirSync(vendorDir).join(', ') || 'res'}`)
  tgz = packed[0]
}
const coreVersion = TARBALL.exec(tgz)![1]
sh('pnpm', ['-C', CLI_PKG, 'pack', '--pack-destination', vendorDir])
const cliPacked = readdirSync(vendorDir).filter((f) => CLI_TARBALL.test(f))
if (cliPacked.length !== 1) fail(`pnpm pack ha d'escriure exactament un create-subur-app-x.y.z.tgz (sense sufix de prerelease) a ${vendorDir}; hi ha: ${readdirSync(vendorDir).join(', ') || 'res'}`)
const cliTgz = cliPacked[0]
// La CLI corre des del tarball extret (el `files` publicat, abans de cap `publish` irreversible; I16), mai des de packages/.
const cliDir = path.join(vendorDir, 'cli')
mkdirSync(cliDir)
const untar = spawnSync('tar', ['-xzf', path.join(vendorDir, cliTgz), '-C', cliDir], { stdio: 'inherit' })
if (untar.error || untar.status !== 0) fail(`tar -xzf ${cliTgz}: ${untar.error?.message ?? `codi ${untar.status}`} (cal tar al PATH)`)
const cliBin = path.join(cliDir, 'package/bin/create-subur-app.js')
if (!existsSync(cliBin)) fail(`el tarball ${cliTgz} no porta bin/create-subur-app.js`)
const cliVersion = (JSON.parse(readFileSync(path.join(cliDir, 'package/package.json'), 'utf8')) as { version: string }).version
const sha512 = (file: string) => `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`
const integrity = sha512(path.join(vendorDir, tgz))
ok(1, `vendor/${tgz} (${integrity.slice(0, 19)}…); CLI ${cliTgz}`)

// 2. l'app, creada per la CLI: amb la branca de build en sec (sense --no-build), sense --repo ni --business. Sense --repo,
// la CLI exigeix una identitat de git configurada (el runner no en té): la del CI, per l'entorn.
const ciIdentity = { GIT_AUTHOR_EMAIL: 'ci@subur.dev', GIT_AUTHOR_NAME: 'acceptance', GIT_COMMITTER_EMAIL: 'ci@subur.dev', GIT_COMMITTER_NAME: 'acceptance' }
sh('node', [cliBin, app, '--slug', 'demo', '--domain', 'demo.example', '--locale', 'ca', '--name', NAME, '--core-tarball', path.join(vendorDir, tgz)], { env: { ...process.env, ...ciIdentity } })
const appReal = realpathSync(app)
if (insideRepo(appReal)) fail(`l'app ha de ser fora del repositori: ${app}`)
const git = (...args: string[]) => capture('git', ['-C', app, ...args], app)
const subjects = () => git('log', '--format=%s').split('\n').filter(Boolean)
// El commit inicial de la CLI ho inclou tot: un sol commit i l'arbre net.
if (subjects().length !== 1) fail(`després de create, git log ha de tenir exactament un commit: ${subjects().join(' | ')}`)
const dirty = git('status', '--porcelain').trim()
if (dirty) fail(`després de create, l'arbre de l'app no és net:\n${dirty}`)
// `.subur/` de la demo: els tres idiomes que la porta recorre (R19); en un client, el genera subur-business.
// Els fitxers seguits, no el directori del disc: un fitxer no seguit (un .DS_Store) no arriba mai a l'app.
const suburFiles = execFileSync('git', ['ls-files', '-z', '--', '.subur'], { cwd: DEMO, encoding: 'utf8' }).split('\0').filter(Boolean)
if (suburFiles.length === 0) fail('examples/demo/.subur no té cap fitxer seguit per git')
try {
  for (const file of suburFiles) {
    mkdirSync(path.dirname(path.join(app, file)), { recursive: true })
    cpSync(path.join(DEMO, file), path.join(app, file))
  }
} catch (error) {
  fail(`còpia de .subur/ de la demo a l'app: ${error instanceof Error ? error.message : String(error)}`)
}
sh('git', ['-C', app, 'add', '-A'])
sh('git', ['-C', app, '-c', 'user.name=acceptance', '-c', 'user.email=ci@subur.dev', 'commit', '-qm', 'chore: .subur'])
// L'app resol com un client (cap override) i depèn del tarball d'aquesta passada.
const pkgPath = path.join(app, 'package.json')
const workspaceYaml = path.join(app, 'pnpm-workspace.yaml')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown> & { dependencies: Record<string, string> }
for (const key of ['overrides', 'pnpm', 'resolutions']) if (key in pkg) fail(`el package.json de l'app no pot dur «${key}»: l'acceptació resol com un client`)
const yaml = existsSync(workspaceYaml) ? readFileSync(workspaceYaml, 'utf8') : ''
for (const key of ['overrides', 'packageExtensions']) if (new RegExp(`^${key}\\s*:`, 'm').test(yaml)) fail(`el pnpm-workspace.yaml de l'app no pot dur «${key}»`)
// Un .pnpmfile també reescriu dependències (`readPackage`) o el lock que s'escriu (`afterAllResolved`; mutació A1c).
for (const file of PNPMFILES) if (existsSync(path.join(app, file))) fail(`l'app no pot dur ${file}: l'acceptació resol com un client`)
if (pkg.dependencies['@suburlabs/core'] !== `file:./vendor/${tgz}`) fail(`package.json de l'app: @suburlabs/core és «${pkg.dependencies['@suburlabs/core']}», no file:./vendor/${tgz}`)
if (!existsSync(path.join(app, 'vendor', tgz)) || sha512(path.join(app, 'vendor', tgz)) !== integrity) fail(`vendor/${tgz} de l'app no és el tarball d'aquesta passada`)
// El lock l'ha escrit la instal·lació de la CLI, contra el tarball d'aquesta passada; l'etapa `deps` de la imatge l'instal·la congelat.
const lock = readFileSync(path.join(app, 'pnpm-lock.yaml'), 'utf8')
if (!lock.includes(`vendor/${tgz}`)) fail(`pnpm-lock.yaml no cita vendor/${tgz}`)
const entry = lock.match(new RegExp(`^ {2}'@suburlabs/core@file:vendor/${tgz.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\n {4}resolution: \\{integrity: ([^,}]+)`, 'm'))
if (entry?.[1] !== integrity) fail(`la integritat del lock per a vendor/${tgz} (${entry?.[1] ?? 'cap entrada'}) no és la del tarball (${integrity})`)
const installed = realpathSync(path.join(app, 'node_modules/@suburlabs/core'))
if (installed.startsWith(`${repo}${path.sep}`) || !installed.includes(`${path.sep}.pnpm${path.sep}@suburlabs+core@file+vendor+${tgz}`)) fail(`@suburlabs/core no ve de vendor/${tgz}: ${installed}`)
// Tots els destins d'`exports` i `bin` del paquet instal·lat hi han de ser: un tarball sense dist/ (o amb un `files` curt)
// s'instal·la igualment i només fallaria al build de la imatge; així falla aquí, també amb --prepare-only.
const manifest = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8')) as { bin?: Record<string, string>; exports: Record<string, Record<string, string> | string> }
const targets = [...new Set([...Object.values(manifest.exports).flatMap((t) => (typeof t === 'string' ? [t] : Object.values(t))), ...Object.values(manifest.bin ?? {}), './dist/bin/subur.js'])]
const missing = targets.filter((t) => !existsSync(path.join(installed, t)))
if (missing.length > 0) fail(`el tarball no porta ${missing.join(', ')}`)
// Evidència de la resolució lliure: la versió que ha triat pnpm (la 0.2.11 obliga a externalitzar @c15t/backend, R1).
const openapi = readdirSync(path.join(app, 'node_modules/.pnpm')).filter((d) => d.startsWith('@standard-community+standard-openapi@')).map((d) => d.split('@')[2].split('_')[0])
// Les ordres del client sobre l'app creada (el job `check` de client-image.yml, abans de cap publish): `sync` ja l'ha corregut
// la CLI (no escriu res), `check` passa les 11, typecheck i lint, i `facts` llegeix els tres idiomes del `.subur/` copiat.
if (!capture('pnpm', ['-s', 'exec', 'subur', 'sync'], app).includes('(0 escrits)')) fail('subur sync sobre l\'app creada ha escrit fitxers: ha de ser idempotent')
const CHECKS = 'check: ok (11 comprovacions)'
if (!capture('pnpm', ['-s', 'exec', 'subur', 'check'], app).includes(CHECKS)) fail(`subur check no diu «${CHECKS}»`)
capture('pnpm', ['-s', 'typecheck'], app)
capture('pnpm', ['-s', 'lint'], app)
const LOCALES = ['ca', 'es', 'en']
const factsOut = capture('pnpm', ['-s', 'exec', 'subur', 'facts', '--json'], app)
const facts = (() => {
  try {
    return JSON.parse(factsOut) as { activeLocales?: unknown } | null
  } catch {
    return fail(`subur facts --json no ha escrit un JSON: ${factsOut.trim().split('\n')[0]?.slice(0, 200) ?? ''}`)
  }
})()
const activeLocales = facts?.activeLocales
if (!isDeepStrictEqual(activeLocales, LOCALES)) fail(`subur facts: activeLocales és ${JSON.stringify(activeLocales)}, no ${JSON.stringify(LOCALES)}`)
const history = subjects()
const created = `feat: web de ${NAME}, creada amb create-subur-app ${coreVersion}`
if (!isDeepStrictEqual(history, ['chore: .subur', created])) fail(`git log de l'app: ${JSON.stringify(history)}, no ["chore: .subur", "${created}"]`)
ok(
  2,
  `app a ${app} creada amb create-subur-app ${cliVersion} (tarball); @suburlabs/core de ${path.relative(appReal, installed)} (${targets.length} destins d'exports i bin); lock: vendor/${tgz} ${integrity.slice(0, 19)}… = el tarball; standard-openapi ${[...new Set(openapi)].join(', ') || 'cap'}, sense overrides; sync idempotent; check ok (11); typecheck i lint; ${LOCALES.length} idiomes (${LOCALES.join(', ')})`,
)
// --prepare-only: atura després d'ACCEPT 2, sense base ni Docker (cobreix create, sync, check i facts; D64)
if (values['prepare-only']) process.exit(0)

// 3. la imatge, des del Dockerfile de l'app (context = l'app: vendor/ hi és). És un build de producció de debò: els ganxos de
// test del hero només es compilen amb NEXT_PUBLIC_SUBUR_E2E_HOOKS=1 (el build de l'e2e del CI), i aquest build no la rep:
// l'únic build-arg és NEXT_PUBLIC_SERVER_URL, el Dockerfile no la declara i la imatge no la porta a l'entorn.
const E2E_HOOKS = 'NEXT_PUBLIC_SUBUR_E2E_HOOKS'
if (readFileSync(path.join(app, 'Dockerfile'), 'utf8').includes(E2E_HOOKS)) fail(`el Dockerfile de l'app no pot citar ${E2E_HOOKS}`)
sh('docker', ['build', '-t', IMAGE, '--build-arg', `NEXT_PUBLIC_SERVER_URL=${BASE}`, '.'], { cwd: app })
const imageEnv = execFileSync('docker', ['image', 'inspect', IMAGE, '--format', '{{json .Config.Env}}'], { encoding: 'utf8' })
if (imageEnv.includes(E2E_HOOKS)) fail(`la imatge ${IMAGE} porta ${E2E_HOOKS} a l'entorn: no és un build de producció`)
// Els assets del paquet han d'arribar a l'standalone (outputFileTracingIncludes, spec §3.4): la porta no demana mai /_subur/*,
// i sense ells les icones del panell i les miniatures farien 404 (nit de la ronda 3; sonda S35: a /app de la imatge, node_modules
// és pla, com $ST/node_modules del spike, D2).
sh('docker', ['run', '--rm', '--entrypoint', 'sh', IMAGE, '-c', 'test -f node_modules/@suburlabs/core/dist/assets/icons/web-app-manifest-192x192.png && test -n "$(ls node_modules/@suburlabs/core/dist/assets/blocks)"'])
ok(3, `imatge ${IMAGE}, amb els assets del paquet i sense ${E2E_HOOKS}`)

// 4. migracions i seed des de l'app, i el panell amb sessió dins del contenidor; 5. la porta amb la imatge real.
// Els mitjans, fora de l'app: dins, una segona passada sobre la mateixa app els posaria al context de `docker build`.
const mediaDir = mkdtempSync(path.join(tmpdir(), 'subur-acceptance-media-'))
console.log(`ACCEPT · mitjans a ${mediaDir}`)
// La base arriba a cada ordre per l'entorn, mai a la línia d'ordres: execFileSync l'imprimeix si l'ordre falla.
const env = { ...process.env, DATABASE_URL: dbUrl, MEDIA_DIR: mediaDir, MEDIA_STORAGE: 'local' }
sh('pnpm', ['-s', 'exec', 'subur', 'migrate'], { cwd: app, env })
sh('pnpm', ['seed'], { cwd: app, env })
ok(4, `migracions i seed; al contenidor: ${await probeContainer()}`)
// La sortida de la porta passa en directe i, a més, es captura: GATE 3 ha de recórrer els tres idiomes del `.subur/` copiat.
const gate = await tee('pnpm', ['-s', 'exec', 'subur', 'gate', '--image', IMAGE, '--media-dir', mediaDir, '--docker-net', net], { cwd: app, env })
if (gate.status !== 0) fail(`subur gate: codi ${gate.status}`)
const gateLocales = LOCALES.map((locale) => `/${locale}`).join(', ')
if (!new RegExp(`^GATE 3 ok — ${gateLocales}: `, 'm').test(gate.out)) fail(`GATE 3 no cita ${gateLocales}`)
ok(5, `porta de la cau amb la imatge real; GATE 3 a ${gateLocales}`)
if (!values.keep) rmSync(mediaDir, { force: true, recursive: true })
if (!values.keep && !values.app) for (const dir of [app, vendorDir]) rmSync(dir, { force: true, recursive: true })

/** Corre una ordre amb stdout en directe i capturat (stderr heretat); el codi de sortida, o 1 si no ha pogut arrencar. */
function tee(cmd: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv }): Promise<{ out: string; status: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      out += chunk
      process.stdout.write(chunk)
    })
    child.on('error', (error) => {
      console.error(error.message)
      resolve({ out, status: 1 })
    })
    child.on('close', (code) => resolve({ out, status: code ?? 1 }))
  })
}

/**
 * La imatge arrencada contra la base sembrada: l'API de consentiment (@c15t/backend, extern a l'standalone), una icona
 * del paquet servida per /_subur, i vistes del panell AMB sessió. Les dues còpies del motor (contextos de React duplicats)
 * només es veien amb sessió: sense, el panell redirigeix al login i tot sembla sa (ruling R1 de la T12). Cada vista ha de
 * donar 200, sense cap marca d'error del render (un error capturat dins del flux també respon 200) i amb una dada sembrada
 * que només hi surt si la vista s'ha renderitzat de debò. Els valors arriben al contenidor per l'entorn del procés `docker`
 * (`-e NOM` sense valor), com a la porta: mai a la línia d'ordres ni al registre.
 */
async function probeContainer(): Promise<string> {
  const name = 'subur-acceptance'
  // En `bridge`, el contenidor arriba al Postgres del host per `host.docker.internal`.
  const containerDb = net === 'host' ? dbUrl : Object.assign(new URL(dbUrl), { hostname: 'host.docker.internal' }).toString()
  const network = net === 'host' ? ['--network', 'host'] : ['-p', '127.0.0.1:3000:3000', '--add-host', 'host.docker.internal:host-gateway']
  const passed = ['DATABASE_URL', 'SUBUR_SECRET', 'SUBUR_ADMIN_EMAIL', 'SUBUR_ADMIN_PASSWORD', 'CRON_SECRET', 'PREVIEW_SECRET', 'NEXT_PUBLIC_SERVER_URL', 'MEDIA_STORAGE', 'MEDIA_DIR']
  const dockerEnv = { ...process.env, DATABASE_URL: containerDb, MEDIA_DIR: '/app/public/media', MEDIA_STORAGE: 'local', NEXT_PUBLIC_SERVER_URL: BASE }
  execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  sh('docker', ['run', '-d', '--name', name, ...network, ...passed.flatMap((key) => ['-e', key]), '-v', `${mediaDir}:/app/public/media`, IMAGE], { env: dockerEnv, stdio: ['ignore', 'ignore', 'inherit'] })
  const get = (route: string, headers: Record<string, string> = {}) => fetch(`${BASE}${route}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) })
  try {
    const started = Date.now()
    for (;;) {
      if (execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', name], { encoding: 'utf8' }).trim() !== 'true') throw new Error("el contenidor s'ha aturat abans de /api/health 200")
      if ((await get('/api/health').catch(() => null))?.status === 200) break
      if (Date.now() - started > 90_000) throw new Error('/api/health no respon 200 en 90 s')
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    const status = await get('/api/c15t/status')
    if (status.status !== 200) throw new Error(`GET /api/c15t/status: HTTP ${status.status}`)
    const icon = await get('/_subur/icons/web-app-manifest-192x192.png')
    if (icon.status !== 200 || icon.headers.get('content-type') !== 'image/png') throw new Error(`GET /_subur/icons/web-app-manifest-192x192.png: HTTP ${icon.status} ${icon.headers.get('content-type')}`)
    // Sense sessió el panell també respon 200, però el cos porta la redirecció al login dins del flux (`NEXT_REDIRECT`):
    // és el control que fa que «amb sessió, 200 i sense redirecció» provi alguna cosa (sonda de la T20).
    const anonymous = await get('/admin')
    if (anonymous.status !== 200 || !(await anonymous.text()).includes('NEXT_REDIRECT')) throw new Error(`GET /admin sense sessió: HTTP ${anonymous.status}, sense la redirecció al login dins del flux`)
    const login = await fetch(`${BASE}/api/users/login`, {
      body: JSON.stringify({ email: process.env.SUBUR_ADMIN_EMAIL, password: process.env.SUBUR_ADMIN_PASSWORD }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
    })
    const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
    if (!login.ok || !cookie) throw new Error(`POST /api/users/login: HTTP ${login.status}${cookie ? '' : ', sense galeta'}`)
    const api = async <T>(route: string): Promise<T> => {
      const response = await get(route, { Cookie: cookie })
      if (response.status !== 200) throw new Error(`GET ${route} amb sessió: HTTP ${response.status}`)
      return (await response.json()) as T
    }
    // Les marques positives surten de l'API, no de cap literal: el títol d'una pàgina, el nom d'un fitxer, el correu dels ajustos.
    const page = (await api<{ docs: { id: number | string; title?: string }[] }>('/api/pages?limit=1&depth=0')).docs[0]
    const media = (await api<{ docs: { filename?: string }[] }>('/api/media?limit=1&depth=0')).docs[0]
    const settings = await api<{ email?: string }>('/api/globals/site-settings?depth=0')
    if (!page?.title || !media?.filename || !settings.email) throw new Error('el seed no ha deixat cap pàgina amb títol, cap fitxer o cap correu als ajustos')
    const views: Array<[string, string]> = [
      ['/admin', 'href="/admin/collections/pages"'],
      ['/admin/collections/pages', page.title],
      [`/admin/collections/pages/${page.id}`, page.title],
      ['/admin/collections/media', media.filename],
      ['/admin/globals/site-settings', settings.email],
    ]
    for (const [view, marker] of views) {
      const response = await get(view, { Cookie: cookie })
      const problem = viewProblem(response.status, await response.text(), marker)
      if (problem) throw new Error(`GET ${view} amb sessió: ${problem}`)
    }
    // GraphQL amb sessió: `graphql` el porta el nucli i el .npmrc del client el hissa; withPayload l'externalitza (R3/M22).
    const graphql = await fetch(`${BASE}/api/graphql`, {
      body: JSON.stringify({ query: '{ Pages(limit:1) { totalDocs } }' }),
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
    })
    const graphqlBody = await graphql.text()
    const result = (() => {
      try {
        return JSON.parse(graphqlBody) as { data?: { Pages?: { totalDocs?: unknown } }; errors?: unknown }
      } catch {
        return null
      }
    })()
    if (graphql.status !== 200 || !result || result.errors !== undefined || typeof result.data?.Pages?.totalDocs !== 'number') {
      throw new Error(`POST /api/graphql amb sessió: HTTP ${graphql.status}, ${redactLine(graphqlBody.slice(0, 300))}`)
    }
    return `/api/c15t/status 200; icona /_subur 200 image/png; /admin sense sessió redirigeix al login; amb sessió 200, sense marques d'error i amb la seva dada a ${views.map(([view]) => view).join(', ')}; POST /api/graphql amb sessió 200 sense errors (Pages.totalDocs ${result.data.Pages.totalDocs})`
  } catch (error) {
    console.error(`ACCEPT 4 FALLA — ${error instanceof Error ? error.message : String(error)}; docker logs --tail 50 ${name}:`)
    // Línia a línia, amb totes les regles de la porta (redact.ts del paquet): el registre pot citar la base, un JWT o un NOM=valor.
    const { stderr, stdout } = spawnSync('docker', ['logs', '--tail', '50', name], { encoding: 'utf8' })
    const logs = `${stdout ?? ''}${stderr ?? ''}`
    console.error(logs.split('\n').map(redactLine).join('\n'))
    throw error
  } finally {
    execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  }
}
