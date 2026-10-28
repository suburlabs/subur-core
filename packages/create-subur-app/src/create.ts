// core/packages/create-subur-app/src/create.ts — l'ordre de l'spec §4.1, pas a pas
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CreateOptions } from './args.js'
import { CliError } from './args.js'
import { bootstrapPackageJson, NPMRC, WORKSPACE_YAML } from './bootstrap.js'
import { clientPathOf, render, RENDERED, type Vars } from './render.js'

const SCAFFOLD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scaffold')
const walk = (dir: string, base = dir): string[] => readdirSync(dir).filter((e) => e !== '.DS_Store').sort().flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e), base) : [path.relative(base, path.join(dir, e))]))
const run = (cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' })
const write = (file: string, text: string) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }
const has = (cmd: string) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0
// La identitat del commit sense --repo: la configurada, mai endevinada del nom de la màquina (`useConfigOnly`).
const CONFIG_ONLY = ['-c', 'user.useConfigOnly=true']
/** `Nom <correu>` de l'autor i del committer tal com els resoldrà el commit a `cwd`; null si git no en té cap de configurada. */
function gitIdentity(cwd: string): null | string {
  const [author, committer] = ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'].map((v) => spawnSync('git', [...CONFIG_ONLY, 'var', v], { cwd, encoding: 'utf8' }))
  if (author.status !== 0 || committer.status !== 0) return null
  const [a, c] = [author, committer].map((r) => r.stdout.trim().replace(/ \d+ [+-]\d{4}$/, ''))
  return a === c ? a : `${a} (committer ${c})`
}
/** La identitat de la sessió de `gh`: l'adreça `noreply` de GitHub (<id>+<login>@users.noreply.github.com), mai el correu del compte. */
function ghIdentity(): null | { email: string; name: string } {
  const r = spawnSync('gh', ['api', 'user', '--jq', '{id, login, name}'], { encoding: 'utf8' })
  if (r.status !== 0) return null
  try {
    const u = JSON.parse(r.stdout) as { id?: unknown; login?: unknown; name?: unknown }
    if (typeof u.id !== 'number' || !Number.isInteger(u.id) || u.id <= 0 || typeof u.login !== 'string' || !/^[A-Za-z0-9-]+$/.test(u.login)) return null
    const name = typeof u.name === 'string' && u.name.trim() ? u.name.trim() : u.login
    return { email: `${u.id}+${u.login}@users.noreply.github.com`, name }
  } catch {
    return null
  }
}

export type Created = { coreVersion: string; dir: string; pending: string[] }

/** Fins on ha arribat `create`: abans de `local` no s'ha escrit res; a `remote`, el repositori de GitHub ja existeix. */
export type Stage = 'preflight' | 'local' | 'remote'
/** Un error de `create` després d'haver escrit alguna cosa: porta l'etapa perquè la CLI en doni la pista de recuperació. */
export class CreateFailed extends Error {
  constructor(readonly stage: Exclude<Stage, 'preflight'>, readonly dir: string, readonly repo: string | undefined, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
  }
}
/** La línia que diu com sortir d'una creació a mitges, segons l'etapa. */
export function recoveryHint(stage: Exclude<Stage, 'preflight'>, dir: string, repo?: string): string {
  if (stage === 'local') return `pista: ${dir} ha quedat a mitges; esborra ${dir} i torna-ho a provar`
  return `pista: el repositori ${repo} ja existeix a GitHub (no el tornis a crear); posa-hi les variables que faltin (gh variable set … -R ${repo}) i acaba amb git -C ${dir} push -u origin main`
}

export function create(o: CreateOptions, log: (line: string) => void): Created {
  const progress: { stage: Stage } = { stage: 'preflight' }
  try {
    return steps(o, log, progress)
  } catch (error) {
    if (progress.stage === 'preflight') throw error
    throw new CreateFailed(progress.stage, o.dir, o.repo, error)
  }
}

function steps(o: CreateOptions, log: (line: string) => void, progress: { stage: Stage }): Created {
  const { dir } = o
  for (const cmd of ['pnpm', 'git', ...(o.repo ? ['gh'] : [])]) if (!has(cmd)) throw new CliError(`cal ${cmd} al PATH`)
  // `gh --version` no diu si hi ha sessió: sense aquesta comprovació, la creació fallaria al final, amb tot ja escrit.
  if (o.repo && spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status !== 0) throw Object.assign(new CliError('gh no té cap sessió activa (gh auth login): cal per a --repo; no s\'ha escrit res'), { exitCode: 1 })
  // La identitat del commit inicial, abans d'escriure res: amb --repo, la `noreply` de la sessió de `gh` (GitHub rebutja
  // el push d'un commit amb el correu privat del compte, GH007); sense, la que git té configurada (fora de cap repositori).
  const gh = o.repo ? ghIdentity() : null
  if (o.repo && !gh) throw Object.assign(new CliError('no s\'ha pogut llegir la identitat de la sessió de gh (gh api user): cal per al commit inicial amb --repo; no s\'ha escrit res'), { exitCode: 1 })
  if (!o.repo && !gitIdentity(os.tmpdir())) throw Object.assign(new CliError('git no té cap identitat configurada (git config --global user.name "…" i user.email "…"; una identitat que només dona un includeIf per al directori nou, la comprovació no la veu: usa --repo o git config --global): cal per al commit inicial; no s\'ha escrit res'), { exitCode: 1 })
  if (existsSync(dir) && (!statSync(dir).isDirectory() || readdirSync(dir).length > 0)) throw new CliError(`${dir} existeix i no és buit`)
  const vars: Vars = { coreVersion: o.coreVersion, domain: o.domain, locale: o.locale, name: o.name, slug: o.slug }
  log(`create-subur-app: ${o.name} (${o.slug}, ${o.domain}, ${o.locale}) a ${dir}`)
  // 1. El repositori, primer: `subur check` exigeix git i el directori ha de ser la SEVA arrel (no la d'un repositori de fora).
  progress.stage = 'local'
  mkdirSync(dir, { recursive: true })
  run('git', ['init', '-q', '-b', 'main'], dir)
  // Amb --repo, la identitat queda a la configuració del clon: els commits següents de qui hi treballi també són `noreply`.
  if (gh) for (const [key, value] of [['user.name', gh.name], ['user.email', gh.email]]) run('git', ['config', key, value], dir)
  const identity = gh ? `${gh.name} <${gh.email}>` : gitIdentity(dir)
  if (!identity) throw new Error('git no té cap identitat configurada per a aquest directori: cal per al commit inicial')
  log(`commit inicial amb ${identity}`)
  // 2. El mínim per instal·lar el nucli (R2): package.json, .npmrc (hoisting), pnpm-workspace.yaml (allowBuilds) i, si cal, el tarball.
  let coreSpec = o.coreVersion
  if (o.coreTarball) {
    mkdirSync(path.join(dir, 'vendor'), { recursive: true })
    copyFileSync(o.coreTarball, path.join(dir, 'vendor', path.basename(o.coreTarball)))
    coreSpec = `file:./vendor/${path.basename(o.coreTarball)}`
  }
  write(path.join(dir, 'package.json'), bootstrapPackageJson(o.slug, coreSpec))
  write(path.join(dir, '.npmrc'), NPMRC)
  write(path.join(dir, 'pnpm-workspace.yaml'), WORKSPACE_YAML)
  // Mai congelat: amb CI=true pnpm congelaria el lock i la segona instal·lació fallaria (ronda 1, O2).
  run('pnpm', ['install', '--no-frozen-lockfile'], dir)
  // 3. Les plantilles del nucli instal·lat (la font única), renderitzades; en mode tarball, la dependència continua apuntant al tarball.
  const core = path.join(dir, 'node_modules/@suburlabs/core')
  const installed = (JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8')) as { version: string }).version
  if (installed !== o.coreVersion) throw new CliError(`s'ha instal·lat @suburlabs/core ${installed}, no ${o.coreVersion}`)
  const templates = path.join(core, 'templates/client')
  for (const rel of walk(templates)) {
    let text = render(readFileSync(path.join(templates, rel), 'utf8'), vars)
    if (rel === 'package.json' && o.coreTarball) text = text.replace(`"@suburlabs/core": "${o.coreVersion}"`, `"@suburlabs/core": "${coreSpec}"`)
    write(path.join(dir, clientPathOf(rel)), text)
  }
  // 4. La bastida de la CLI: el contingut que el client fa seu (R2). Només RENDERED es renderitza; la resta, byte a byte (R24).
  for (const rel of walk(SCAFFOLD)) {
    const from = path.join(SCAFFOLD, rel); const to = path.join(dir, rel)
    if (RENDERED.includes(rel)) write(to, render(readFileSync(from, 'utf8'), vars)); else { mkdirSync(path.dirname(to), { recursive: true }); copyFileSync(from, to) }
  }
  run('pnpm', ['install', '--no-frozen-lockfile'], dir)   // les devDependencies de la plantilla i el lock definitiu
  // 5. `.subur/` des del registre (spec §4.1 pas 3; R19)
  const pending: string[] = []
  if (o.business) run('pnpm', ['-C', o.business, '-s', 'subur', 'client', 'project', o.slug, '--repo', dir], dir)
  else pending.push(`.subur/: des de subur-business, pnpm -s subur client project ${o.slug} --repo ${dir}`)
  // 6. Els fitxers del nucli, la comprovació i, si no es demana el contrari, el build en sec (spec §4.1 pas 4)
  run('pnpm', ['-s', 'exec', 'subur', 'sync'], dir)
  run('pnpm', ['-s', 'exec', 'subur', 'check'], dir)
  if (!o.noBuild) run('pnpm', ['build'], dir, { ...process.env, DATABASE_URL: 'postgres://build-only:x@127.0.0.1:1/build_only', NEXT_TELEMETRY_DISABLED: '1', SUBUR_SECRET: 'build-only' })
  // 7. El primer commit (spec §4.1 pas 5), amb la identitat de la comprovació prèvia. Amb --repo, per l'entorn: les variables
  // GIT_AUTHOR_*/GIT_COMMITTER_* guanyen a tota configuració (user.*, i també author.*/committer.*, que guanyarien a un
  // `-c user.email`), també a les de l'entorn de qui la crida. Sense --repo, la de git, mai endevinada.
  const commitEnv = gh ? { ...process.env, GIT_AUTHOR_EMAIL: gh.email, GIT_AUTHOR_NAME: gh.name, GIT_COMMITTER_EMAIL: gh.email, GIT_COMMITTER_NAME: gh.name } : process.env
  run('git', ['add', '-A'], dir)
  run('git', [...(gh ? [] : CONFIG_ONLY), 'commit', '-q', '-m', `feat: web de ${o.name}, creada amb create-subur-app ${o.coreVersion}`], dir, commitEnv)
  // 8. GitHub (spec §4.1 pas 6): el repositori privat, les variables ABANS del primer push, i el push
  if (o.repo) {
    run('gh', ['repo', 'create', o.repo, '--private'], dir)
    progress.stage = 'remote'
    run('git', ['remote', 'add', 'origin', `https://github.com/${o.repo}.git`], dir)
    run('gh', ['variable', 'set', 'SITE_URL', '-R', o.repo, '-b', o.siteUrl!], dir)
    if (o.umamiWebsiteId && o.umamiScriptUrl) {
      run('gh', ['variable', 'set', 'UMAMI_WEBSITE_ID', '-R', o.repo, '-b', o.umamiWebsiteId], dir)
      run('gh', ['variable', 'set', 'UMAMI_SCRIPT_URL', '-R', o.repo, '-b', o.umamiScriptUrl], dir)
    }
    run('git', ['push', '-q', '-u', 'origin', 'main'], dir)
  } else pending.push('repositori a GitHub (gh repo create suburlabs/<id> --private; gh variable set SITE_URL abans del primer push)')
  if (!(o.umamiWebsiteId && o.umamiScriptUrl)) pending.push('variables UMAMI_WEBSITE_ID i UMAMI_SCRIPT_URL al repositori (totes dues o cap)')
  pending.push('alta a la plataforma: ops alta --repo <aquest directori> des de subur-ops')
  pending.push(`client.template a subur-business: subur client set ${o.slug} --template subur-core@${o.coreVersion}`)
  return { coreVersion: o.coreVersion, dir, pending }
}
