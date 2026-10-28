// core/packages/core/src/bin/check.ts — `subur check` (spec §4.1; pla E2, R5): les 11 comprovacions sobre el client del cwd
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SiteConfig } from '../site/index.js'
import { APP_FILES, GENERATED_FILES, IMPORT_MAP, isEnginePackage, PNPMFILES, REPO_FILES } from '../templates/files.js'
import { checkClientImports, checkExactFiles, checkGitignore, checkNextConfig, checkPackageJson, checkThemeColor, checkThemeTokens, type Problem } from '../templates/checks.js'
import { readClientTemplates, renderTemplate, type TemplateVars } from '../templates/render.js'
import { loadSiteConfig } from './loadClient.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export type CheckResult = { count: number; problems: Problem[]; skipped: string[] }
export const UPDATE_HINT = 'pnpm install && pnpm exec subur update'
// Els camins amb claudàtors són globs per a git: literals sempre (ls-files els admet; check-ignore no: no s'usa); cap color.
const GIT = ['-c', 'color.ui=never', '--literal-pathspecs']

/** Les fonts del client: sense seguir enllaços simbòlics (no ho són; un de penjat o un cicle trencarien el recorregut). */
const walk = (dir: string, base: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).sort().flatMap((e) => {
        const stat = lstatSync(path.join(dir, e))
        if (stat.isSymbolicLink()) return []
        return stat.isDirectory() ? walk(path.join(dir, e), base) : [path.relative(base, path.join(dir, e))]
      })
    : []
const firstLine = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\n')[0]

export async function check(cwd: string): Promise<CheckResult> {
  const read = (f: string) => (existsSync(path.join(cwd, f)) ? readFileSync(path.join(cwd, f), 'utf8') : null)
  const problems: Problem[] = []
  const skipped: string[] = []
  let count = 0
  const step = (found: Problem[]) => { count += 1; problems.push(...found) }
  // (1) git: sense repositori res més no s'avalua; `isRepoRoot` decideix si els fitxers de repositori li toquen (un membre
  //     d'un workspace, com la demo, no en té: R5)
  const top = spawnSync('git', [...GIT, 'rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  if (top.status !== 0) return { count: 1, problems: [{ check: 'git', detail: 'el client ha de ser un repositori git' }], skipped }
  count = 1
  const repoRoot = realpathSync(top.stdout.trim())
  const isRepoRoot = repoRoot === realpathSync(cwd)
  const corePkg = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; version: string }
  // Els fets del client (les variables de les plantilles i themeColor). Si site.config.ts no es pot carregar (falta, o falta el
  // tsconfig.json amb què es carrega), és un problema més: la resta de comprovacions corren igual i només s'ometen (o es
  // redueixen a la presència dels fitxers) les que en depenen, (2), (3), (6) i (8).
  let siteConfig: SiteConfig | null = null
  try {
    siteConfig = await loadSiteConfig(cwd)
  } catch (error) {
    problems.push({ check: 'site.config', detail: existsSync(path.join(cwd, 'src/site/site.config.ts')) ? `no es pot carregar src/site/site.config.ts: ${firstLine(error)}` : 'falta src/site/site.config.ts' })
    skipped.push('sense site.config: les plantilles exactes presents, el package.json i themeColor no es comparen')
  }
  const vars: TemplateVars | null = siteConfig && { coreVersion: corePkg.version, domain: siteConfig.domain, locale: siteConfig.clientLocale as 'ca' | 'es', name: siteConfig.name, slug: siteConfig.id }
  const templates = readClientTemplates()
  // (2) i (3) plantilles exactes; sense els fets, només si hi són
  const exact = (which: readonly string[]) => (vars ? checkExactFiles(read, templates, vars, which, UPDATE_HINT) : which.filter((f) => read(f) === null).map((f) => ({ check: 'plantilla', detail: `falta ${f} (${UPDATE_HINT})` })))
  step(exact(APP_FILES))
  if (isRepoRoot) step(exact(REPO_FILES))
  else skipped.push(`membre d'un workspace: ${REPO_FILES.length} fitxers de repositori no comprovats (${REPO_FILES.join(', ')})`)
  // (4) .gitignore
  step(checkGitignore(read('.gitignore')))
  // (5) generats: presents, no seguits, ignorats. `check-ignore` no admet `--literal-pathspecs` (128) i, sense l'opció, el camí
  //     és un glob contra l'índex: l'estat real el donen dues crides a `ls-files` amb camins literals (relatius al cwd).
  const generated = [...GENERATED_FILES, IMPORT_MAP]
  const lsFiles = (...flags: string[]) => new Set(execFileSync('git', [...GIT, 'ls-files', '-z', ...flags, '--', ...generated], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean))
  const tracked = lsFiles('--cached')
  const ignored = lsFiles('--others', '--ignored', '--exclude-standard')
  step(generated.flatMap((f): Problem[] => {
    const present = existsSync(path.join(cwd, f))
    return [
      ...(present ? [] : [{ check: 'generats', detail: `falta ${f}: executa subur sync` }]),
      ...(tracked.has(f) ? [{ check: 'generats', detail: `${f} està versionat: és propietat del nucli (git rm --cached)` }] : []),
      ...(present && !tracked.has(f) && !ignored.has(f) ? [{ check: 'generats', detail: `git no ignora ${f}: ${UPDATE_HINT}` }] : []),
    ]
  }))
  // (6) package.json
  const pkg = read('package.json')
  const pkgTemplate = templates.find((t) => t.clientPath === 'package.json')!
  const engineVersions = Object.fromEntries(Object.entries(corePkg.dependencies).filter(([n]) => isEnginePackage(n)))
  const packageJson = (): Problem[] => {
    if (pkg === null) return [{ check: 'package.json', detail: 'falta package.json' }]
    let parsed: unknown
    try {
      parsed = JSON.parse(pkg)
    } catch (error) {
      return [{ check: 'package.json', detail: `JSON invàlid: ${firstLine(error)}` }]
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [{ check: 'package.json', detail: 'JSON invàlid: no és un objecte' }]
    return vars ? checkPackageJson(parsed, JSON.parse(renderTemplate(pkgTemplate.text, vars)), corePkg.version, { engineVersions, member: !isRepoRoot }) : []
  }
  // Un .pnpmfile reescriu les dependències en instal·lar (`readPackage`) o el lock (`afterAllResolved`): el motor tornaria a ser
  // del client. No depèn del package.json: es diu sempre. En un membre, pnpm el llegeix de l'arrel del workspace, que és algun
  // directori entre el client i l'arrel del repositori: es miren tots.
  const upToRepoRoot = (dir: string): string[] => (dir === repoRoot || path.dirname(dir) === dir ? [dir] : [dir, ...upToRepoRoot(path.dirname(dir))])
  const pnpmfiles = upToRepoRoot(realpathSync(cwd)).flatMap((dir, i) =>
    PNPMFILES.filter((f) => existsSync(path.join(dir, f))).map((f) => ({
      check: 'package.json',
      detail: `${i === 0 ? `${f} a l'arrel del client` : `${path.relative(realpathSync(cwd), path.join(dir, f))} més amunt del client (pnpm el llegeix a l'arrel del workspace)`}: pot reescriure les dependències del motor en instal·lar; treu-lo`,
    })),
  )
  step([...packageJson(), ...pnpmfiles])
  // (7) i (8) el tema
  const theme = read('src/site/theme.css')
  const coreCss = readFileSync(path.join(PKG, 'dist/css/core.css'), 'utf8') + readFileSync(path.join(PKG, 'dist/css/primitives.css'), 'utf8')
  step(theme === null ? [{ check: 'tokens', detail: 'falta src/site/theme.css' }] : checkThemeTokens(coreCss, theme))
  step(theme === null || siteConfig === null ? [] : checkThemeColor(siteConfig.themeColor, theme))
  // (9) importacions: tot src/site/** llevat dels generats (seed/run.ts importa el motor i @payload-config: és del nucli)
  const generatedSet = new Set<string>(GENERATED_FILES)
  step(checkClientImports(walk(path.join(cwd, 'src/site'), cwd).filter((f) => /\.[cm]?[jt]sx?$/.test(f) && !f.endsWith('.d.ts') && !generatedSet.has(f)).map((f) => ({ path: f, text: read(f)! }))))
  // (10) next.config.ts
  step(checkNextConfig(read('next.config.ts')))
  // (11) vendor/
  step(existsSync(path.join(cwd, 'vendor')) ? [] : [{ check: 'vendor', detail: 'falta el directori vendor/ (el Dockerfile el copia; prou un README.md)' }])
  return { count, problems, skipped }
}
