// core/packages/core/src/templates/checks.ts — les comprovacions de `subur check`, pures (spec §4.1; pla E2, R5)
import { parseCssColorScopes } from '../utilities/contrast.js'
import { CLIENT_API, CORE_SCRIPTS, isEnginePackage, REQUIRED_GITIGNORE } from './files.js'
import { renderTemplate, type Template, type TemplateVars } from './render.js'

export type Problem = { check: string; detail: string }

// (7) Tokens del tema (abans examples/demo/tests/int/tokens.int.spec.ts; spec §3.4, ruling P30 d'E1)
export const consumedTokens = (css: string) => new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))
export const definedAtRoot = (css: string) => new Set([...css.matchAll(/(?:^|\n)\s*(?::root|\.dark)\s*\{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((d) => d[1])))
/** Definides al `:root` de primer nivell (el tema clar): una que només és a `.dark` o dins d'un `@media` deixaria el token sense valor en mode clar. */
export const definedAtLightRoot = (css: string) => new Set([...css.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((d) => d[1])))
/** Variables que no són del tema: les defineix Tailwind (@theme), Radix, next/font o els components en línia. */
export const NOT_THEME = new Set(['--ease-shutter', '--text-body', '--gap', '--slat-color', '--radix-navigation-menu-viewport-height', '--radix-navigation-menu-viewport-width', '--font-display-face', '--font-text-face'])
export function checkThemeTokens(coreCss: string, themeCss: string): Problem[] {
  const light = definedAtLightRoot(themeCss)
  const missing = [...consumedTokens(coreCss)].filter((t) => !NOT_THEME.has(t) && !light.has(t))
  const both = [...definedAtRoot(coreCss)].filter((t) => definedAtRoot(themeCss).has(t))
  return [
    ...missing.map((t) => ({ check: 'tokens', detail: `theme.css no defineix ${t} al :root clar (el nucli el consumeix)` })),
    ...both.map((t) => ({ check: 'tokens', detail: `${t} es defineix a :root/.dark al nucli i a theme.css` })),
  ]
}

// (8) themeColor = fons de :root i .dark (abans examples/demo/tests/int/themeColor.int.spec.ts)
export function checkThemeColor(themeColor: { dark: string; light: string }, themeCss: string): Problem[] {
  const scopes = parseCssColorScopes(themeCss)
  const problems: Problem[] = []
  const keys = Object.keys(themeColor).sort()
  if (keys.length !== 2 || keys[0] !== 'dark' || keys[1] !== 'light') problems.push({ check: 'themeColor', detail: `themeColor ha de tenir exactament light i dark (té ${keys.join(', ')})` })
  if (themeColor.light?.toLowerCase() !== scopes.root.background) problems.push({ check: 'themeColor', detail: `themeColor.light (${themeColor.light}) ≠ --background de :root (${scopes.root.background})` })
  if (themeColor.dark?.toLowerCase() !== scopes.dark.background) problems.push({ check: 'themeColor', detail: `themeColor.dark (${themeColor.dark}) ≠ --background de .dark (${scopes.dark.background})` })
  return problems
}

// (9) Importacions de src/site/** (spec §4.2: «tot importa només l'API del client»). Els generats no hi entren (el qui crida els filtra).
const SPEC = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
export const specifiersOf = (text: string) => [...text.matchAll(SPEC)].map((m) => m[1])
export function checkClientImports(files: Array<{ path: string; text: string }>): Problem[] {
  return files.flatMap(({ path: file, text }) =>
    specifiersOf(text)
      .filter((s) => {
        if (file === 'src/site/site.config.ts') return s !== '@suburlabs/core/site'
        if (s.startsWith('./') || s.startsWith('../') || s.startsWith('node:')) return false
        if (file === 'src/site/fonts.ts' && s === 'next/font/google') return false
        return !CLIENT_API.includes(s)
      })
      .map((s) => ({ check: 'imports', detail: `${file} importa «${s}»: ${file === 'src/site/site.config.ts' ? 'site.config.ts només pot importar @suburlabs/core/site' : `src/site/ només pot importar relatius, node:*, ${CLIENT_API.join(', ')} (i fonts.ts, next/font/google)`}` })),
  )
}

// (10) next.config.ts
export function checkNextConfig(text: string | null): Problem[] {
  if (text === null) return [{ check: 'next.config', detail: 'falta next.config.ts' }]
  const problems: Problem[] = []
  if (!/from\s+['"]@suburlabs\/core\/next['"]/.test(text)) problems.push({ check: 'next.config', detail: "next.config.ts no importa withSubur de '@suburlabs/core/next'" })
  if (!/export\s+default\s+withSubur\(/.test(text)) problems.push({ check: 'next.config', detail: 'next.config.ts no exporta per defecte withSubur(…)' })
  return problems
}

// (6) package.json contra la plantilla (camps, no bytes). `member`: un membre d'un workspace (la demo) pot dur `workspace:*`, el motor
// a la versió exacta del nucli a `dependencies`/`devDependencies` (R3, R4) i una ordre simple davant de `preseed` (`<ordre> && <plantilla>`:
// la guarda de base de la demo abans del seed); `dev` i `start` són del client i no es comparen mai.
type Deps = Record<string, string>
type Pkg = { dependencies?: Deps; devDependencies?: Deps; engines?: { node?: string }; optionalDependencies?: Deps; overrides?: Record<string, unknown>; packageManager?: string; peerDependencies?: Deps; pnpm?: { overrides?: Deps; packageExtensions?: Record<string, { dependencies?: Deps; optionalDependencies?: Deps; peerDependencies?: Deps }> }; resolutions?: Deps; scripts?: Record<string, string>; type?: string }
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** Els noms de paquet que cita una clau d'override, en qualsevol de les formes (`next`, `next@16`, `foo>next`, `foo/next`, `foo/@payloadcms/ui`;
 *  el comodí de yarn també). L'`@<rang o etiqueta>` de cada segment no és cap paquet: `sharp@next` és sharp. */
const NAME = /((?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*)(?:@[^>/\s]*)?/gi
const namesInOverrideKey = (key: string) => [...key.matchAll(NAME)].map((m) => m[1])
/** Les claus d'un mapa d'overrides que citen un paquet del motor; els d'npm poden niar (`{ foo: { next: … } }` → «foo > next»). */
function enginePins(field: string, map: unknown, parents: string[] = []): Problem[] {
  if (!isObject(map)) return []
  return Object.entries(map).flatMap(([key, value]) => {
    const shown = [...parents, key].join(' > ')
    return [
      ...namesInOverrideKey(key).filter(isEnginePackage).map((name) => ({ check: 'package.json', detail: `${field} re-fixa ${name} («${shown}»): el porta el nucli; treu-lo` })),
      ...enginePins(field, value, [...parents, key]),
    ]
  })
}
/** `pnpm.packageExtensions`: afegir un paquet del motor a les dependències d'un altre també el torna a fixar. */
function engineExtensions(map: unknown): Problem[] {
  if (!isObject(map)) return []
  return Object.entries(map).flatMap(([key, extension]) =>
    (['dependencies', 'peerDependencies', 'optionalDependencies'] as const).flatMap((field) => {
      const deps = isObject(extension) ? extension[field] : undefined
      return Object.keys(isObject(deps) ? deps : {}).filter(isEnginePackage).map((name) => ({ check: 'package.json', detail: `pnpm.packageExtensions re-fixa ${name} («${key}»): el porta el nucli; treu-lo` }))
    }),
  )
}
/** El prefix que un membre pot posar davant de `preseed`: una sola ordre simple (cap `#`, `;`, `|`, `&`, `$`, cometes ni salt de línia). */
const MEMBER_PREFIX = /^[A-Za-z0-9_./ -]+$/
export function checkPackageJson(pkg: Pkg, template: Pkg, installedVersion: string, { engineVersions = {}, member = false }: { engineVersions?: Record<string, string>; member?: boolean } = {}): Problem[] {
  const problems: Problem[] = []
  const spec = pkg.dependencies?.['@suburlabs/core']
  const vendored = `file:./vendor/suburlabs-core-${installedVersion}.tgz`
  const accepted = [installedVersion, vendored, ...(member ? ['workspace:*'] : [])]
  if (spec === undefined || !accepted.includes(spec)) problems.push({ check: 'package.json', detail: `@suburlabs/core és «${spec ?? 'absent'}»; cal la versió exacta instal·lada, ${installedVersion} (o ${vendored})` })
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    const deps = pkg[field]
    for (const [name, version] of Object.entries(isObject(deps) ? deps : {})) {
      if (!isEnginePackage(name)) continue
      if (member && (field === 'dependencies' || field === 'devDependencies') && engineVersions[name] === version) continue
      problems.push({ check: 'package.json', detail: `${field} declara ${name}: el porta el nucli; treu-lo` })
    }
  }
  // Re-fixar el motor per la porta del darrere: cap excepció per a un membre (cap override és una dependència declarada)
  const pnpm: NonNullable<Pkg['pnpm']> = isObject(pkg.pnpm) ? pkg.pnpm : {}
  problems.push(...enginePins('overrides', pkg.overrides), ...enginePins('resolutions', pkg.resolutions), ...enginePins('pnpm.overrides', pnpm.overrides), ...engineExtensions(pnpm.packageExtensions))
  for (const field of ['packageManager', 'type'] as const) if (pkg[field] !== template[field]) problems.push({ check: 'package.json', detail: `${field} és «${pkg[field] ?? 'absent'}», la plantilla diu «${template[field]}»` })
  if (pkg.engines?.node !== template.engines?.node) problems.push({ check: 'package.json', detail: `engines.node és «${pkg.engines?.node ?? 'absent'}», la plantilla diu «${template.engines?.node}»` })
  for (const name of CORE_SCRIPTS) {
    const [script, want] = [pkg.scripts?.[name], template.scripts?.[name]]
    const guarded = member && name === 'preseed' && want !== undefined && script?.endsWith(` && ${want}`) && MEMBER_PREFIX.test(script.slice(0, -` && ${want}`.length))
    if (script === want || guarded) continue
    problems.push({ check: 'package.json', detail: `scripts.${name} és «${script ?? 'absent'}», la plantilla diu «${want}»` })
  }
  return problems
}

// (4) .gitignore
export function checkGitignore(text: string | null): Problem[] {
  if (text === null) return [{ check: '.gitignore', detail: 'falta .gitignore' }]
  const lines = new Set(text.split('\n').map((l) => l.trim()))
  return REQUIRED_GITIGNORE.filter((l) => !lines.has(l)).map((l) => ({ check: '.gitignore', detail: `falta la línia «${l}»` }))
}

// (2) i (3) plantilles exactes
export function checkExactFiles(readClient: (clientPath: string) => string | null, templates: Template[], vars: TemplateVars, which: readonly string[], updateHint: string): Problem[] {
  const byPath = new Map(templates.map((t) => [t.clientPath, t.text]))
  return which.flatMap((f) => {
    const template = byPath.get(f)
    if (template === undefined) return [{ check: 'plantilla', detail: `el nucli no té plantilla per a ${f}` }]
    const current = readClient(f)
    if (current === null) return [{ check: 'plantilla', detail: `falta ${f} (${updateHint})` }]
    return current === renderTemplate(template, vars) ? [] : [{ check: 'plantilla', detail: `${f} no és la plantilla de la versió instal·lada (${updateHint})` }]
  })
}
