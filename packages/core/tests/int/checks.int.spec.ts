// core/packages/core/tests/int/checks.int.spec.ts — les comprovacions pures de `subur check` (spec §3.4, §4.1; pla E2, R5, R14)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { siteConfig } from '../../../../examples/demo/src/site/site.config.js'
import { checkClientImports, checkExactFiles, checkGitignore, checkNextConfig, checkPackageJson, checkThemeColor, checkThemeTokens, consumedTokens, definedAtLightRoot, definedAtRoot, NOT_THEME } from '../../src/templates/checks.js'
import { CORE_SCRIPTS, REQUIRED_GITIGNORE } from '../../src/templates/files.js'
import { parseCssColorScopes } from '../../src/utilities/contrast.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO = path.join(PKG, '../../examples/demo')
const core = readFileSync(path.join(PKG, 'dist/css/core.css'), 'utf8') + readFileSync(path.join(PKG, 'dist/css/primitives.css'), 'utf8')
const theme = readFileSync(path.join(DEMO, 'src/site/theme.css'), 'utf8')

// (7) Abans examples/demo/tests/int/tokens.int.spec.ts (R14): les mateixes afirmacions, ara sobre les funcions de `check`.
describe('tokens del tema (spec §3.4)', () => {
  it('core.css + primitives.css consumeixen només tokens que el tema defineix al :root clar', () => {
    const missing = [...consumedTokens(core)].filter((t) => !NOT_THEME.has(t) && !definedAtLightRoot(theme).has(t))   // §11: el tema de la demo els defineix tots; cap excusa per als definits al nucli (nit de la ronda 2)
    expect(missing).toEqual([])
    expect(checkThemeTokens(core, theme)).toEqual([])
  })
  it('cap propietat es defineix a :root/.dark als dos costats (l\'ordre del CSS no importa)', () => {
    expect([...definedAtRoot(core)].filter((t) => definedAtRoot(theme).has(t))).toEqual([])
    // Negatiu: sense ell, la branca «als dos costats» de checkThemeTokens sobreviu a la mutació (ronda 1, T10)
    expect(checkThemeTokens(':root{--x:1}', ':root{--x:2}')).toEqual([{ check: 'tokens', detail: '--x es defineix a :root/.dark al nucli i a theme.css' }])
  })
  it('canari: definedAtRoot reconeix una definició a :root i a .dark (avui core.css no en té cap; nit de la ronda 3; sonda S36)', () => {
    expect([...definedAtRoot(':root {\n  --x: 1;\n}')]).toEqual(['--x'])
    expect([...definedAtRoot('.dark{--y:2}\n.a{--z:3}')]).toEqual(['--y'])
    // El :root clar no compta ni .dark ni el :root sagnat dins d'un @media
    expect([...definedAtLightRoot(':root {\n  --x: 1;\n}\n.dark {\n  --y: 2;\n}\n@media (width >= 64rem) {\n  :root {\n    --z: 3;\n  }\n}')]).toEqual(['--x'])
  })
})

// (8) Abans examples/demo/tests/int/themeColor.int.spec.ts (R14). Els colors de `<meta name="theme-color">` són els de
// `siteConfig.themeColor`, clar i fosc, en aquest ordre (ho fixa `factories.int.spec.ts`); aquí es mira que coincideixin amb el
// `theme.css` de la demo, derivat amb `parseCssColorScopes`: cap valor hexadecimal escrit aquí. L'afirmació del `viewport` del
// layout és ara a `templates.int.spec.ts` (el layout és un fitxer generat).
const themeColorEntries = [
  { color: siteConfig.themeColor.light, media: '(prefers-color-scheme: light)' },
  { color: siteConfig.themeColor.dark, media: '(prefers-color-scheme: dark)' },
]
const scopes = parseCssColorScopes(theme)

describe('theme-color meta stays in sync with theme.css', () => {
  it('found exactly the light and dark themeColor entries', () => {
    expect(Object.keys(siteConfig.themeColor).sort()).toEqual(['dark', 'light'])
    expect(themeColorEntries).toHaveLength(2)
    expect(checkThemeColor(siteConfig.themeColor, theme)).toEqual([])
    expect(checkThemeColor({ ...siteConfig.themeColor, extra: '#000000' } as { dark: string; light: string }, theme)).toHaveLength(1)
    // Una clau que s'ordena després de light: sense la condició de la llargada, `dark` i `light` als dos primers llocs passarien
    expect(checkThemeColor({ ...siteConfig.themeColor, zz: '#000000' } as { dark: string; light: string }, theme)).toHaveLength(1)
  })
  it('has a light entry matching :root background', () => {
    const light = themeColorEntries.find((entry) => entry.media === '(prefers-color-scheme: light)')
    expect(light).toBeDefined()
    expect(light?.color.toLowerCase()).toBe(scopes.root.background)
    expect(checkThemeColor({ ...siteConfig.themeColor, light: '#000000' }, theme)).toHaveLength(1)
  })
  it('has a dark entry matching .dark background', () => {
    const dark = themeColorEntries.find((entry) => entry.media === '(prefers-color-scheme: dark)')
    expect(dark).toBeDefined()
    expect(dark?.color.toLowerCase()).toBe(scopes.dark.background)
    expect(checkThemeColor({ ...siteConfig.themeColor, dark: '#000000' }, theme)).toHaveLength(1)
  })
})

describe('checkClientImports', () => {
  it('site.config.ts només @suburlabs/core/site (ni seed, ni relatius)', () => {
    expect(checkClientImports([{ path: 'src/site/site.config.ts', text: "import { defineSiteConfig } from '@suburlabs/core/site'\nimport { x } from '@suburlabs/core/seed'" }])).toHaveLength(1)
    expect(checkClientImports([{ path: 'src/site/site.config.ts', text: "import { defineSiteConfig } from '@suburlabs/core/site'\nimport { y } from './fonts'" }])).toHaveLength(1)
  })
  it('src/site/**: relatius, node:, l\'API del client i next/font/google només a fonts.ts', () => {
    const ok = [
      { path: 'src/site/fonts.ts', text: "import { Source_Sans_3 } from 'next/font/google'" },
      { path: 'src/site/seed/media.ts', text: "import path from 'node:path'\nimport type { SeedMedia } from '@suburlabs/core/seed'" },
      { path: 'src/site/seed/content/ca.ts', text: "import { heading } from '@suburlabs/core/seed'\nimport { pages } from './index'\nimport type { Media } from '@suburlabs/core/types'" },
    ]
    expect(checkClientImports(ok)).toEqual([])
    expect(checkClientImports([{ path: 'src/site/seed/content/ca.ts', text: "import { buildSuburConfig } from '@suburlabs/core/config'" }])).toHaveLength(1)
    expect(checkClientImports([{ path: 'src/site/seed/content/ca.ts', text: "import { getPayload } from 'payload'" }])).toHaveLength(1)
    expect(checkClientImports([{ path: 'src/site/seo/schema.ts', text: "import { x } from 'next/font/google'" }])).toHaveLength(1)
  })
  it('el run.ts generat no hi entra mai: qui crida el filtra (el text d\'un run.ts real sí que donaria 2 problemes)', () => {
    expect(checkClientImports([{ path: 'src/site/seed/run.ts', text: "import config from '@payload-config'\nimport { getPayload } from 'payload'" }])).toHaveLength(2)
  })
})
describe('checkNextConfig', () => {
  it('importa withSubur de @suburlabs/core/next i l\'exporta per defecte', () => {
    expect(checkNextConfig("import { withSubur } from '@suburlabs/core/next'\nexport default withSubur({})")).toEqual([])
    expect(checkNextConfig("import { withPayload } from '@payloadcms/next/withPayload'\nexport default withPayload({})")).toHaveLength(2)
    expect(checkNextConfig(null)).toHaveLength(1)
  })
})
describe('checkPackageJson', () => {
  const template = { engines: { node: '>=24' }, packageManager: 'pnpm@10.33.0', scripts: Object.fromEntries(CORE_SCRIPTS.map((s) => [s, `cmd ${s}`])), type: 'module' }
  const good = { dependencies: { '@suburlabs/core': '0.1.0', sharp: '0.35.4' }, engines: { node: '>=24' }, packageManager: 'pnpm@10.33.0', scripts: { ...template.scripts, dev: 'next dev --port 3200', start: 'next start' }, type: 'module' }
  it('net; dev i start són del client', () => expect(checkPackageJson(good, template, '0.1.0')).toEqual([]))
  it('el tarball de vendor amb la mateixa versió també val', () => expect(checkPackageJson({ ...good, dependencies: { '@suburlabs/core': 'file:./vendor/suburlabs-core-0.1.0.tgz' } }, template, '0.1.0')).toEqual([]))
  it('versió diferent, rang, paquet del motor, script que falta, packageManager, engines, type', () => {
    expect(checkPackageJson({ ...good, dependencies: { '@suburlabs/core': '0.1.1' } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, dependencies: { '@suburlabs/core': '^0.1.0' } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, dependencies: { ...good.dependencies, next: '16.3.3' } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, devDependencies: { '@payloadcms/ui': '3.89.0' } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, scripts: { ...good.scripts, lint: undefined as unknown as string } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, packageManager: 'pnpm@9.0.0' }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, engines: { node: '>=22' } }, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, type: 'commonjs' }, template, '0.1.0')).toHaveLength(1)
  })
  it('membre d\'un workspace: workspace:* i el motor a la versió exacta del nucli passen; una altra versió del motor, no; a l\'arrel, cap de les dues', () => {
    const engineVersions = { next: '16.3.3', payload: '3.89.0' }
    const member = { ...good, dependencies: { '@suburlabs/core': 'workspace:*', next: '16.3.3', payload: '3.89.0' } }
    expect(checkPackageJson(member, template, '0.1.0', { engineVersions, member: true })).toEqual([])
    expect(checkPackageJson({ ...member, dependencies: { ...member.dependencies, next: '16.3.2' } }, template, '0.1.0', { engineVersions, member: true })).toHaveLength(1)
    expect(checkPackageJson(member, template, '0.1.0', { engineVersions })).toHaveLength(3)
  })
  it('preseed és del contracte, just abans de seed (run.ts és generat: un clon fresc el necessita abans del seed)', () => {
    expect(CORE_SCRIPTS.indexOf('preseed')).toBeGreaterThanOrEqual(0)
    expect(CORE_SCRIPTS.indexOf('preseed')).toBe(CORE_SCRIPTS.indexOf('seed') - 1)
    expect(checkPackageJson({ ...good, scripts: { ...good.scripts, preseed: undefined as unknown as string } }, template, '0.1.0')).toEqual([{ check: 'package.json', detail: 'scripts.preseed és «absent», la plantilla diu «cmd preseed»' }])
  })
  it('membre d\'un workspace: preseed (i només preseed) pot anteposar una ordre simple (… && plantilla); a l\'arrel no, i al darrere tampoc', () => {
    const guarded = { ...good, scripts: { ...good.scripts, preseed: 'node scripts/assert-demo-db.mjs && cmd preseed' } }
    expect(checkPackageJson(guarded, template, '0.1.0', { member: true })).toEqual([])
    expect(checkPackageJson(guarded, template, '0.1.0')).toHaveLength(1)
    expect(checkPackageJson({ ...good, scripts: { ...good.scripts, preseed: 'cmd preseed && node x.mjs' } }, template, '0.1.0', { member: true })).toHaveLength(1)
    expect(checkPackageJson({ ...good, scripts: { ...good.scripts, preseed: 'xcmd preseed' } }, template, '0.1.0', { member: true })).toHaveLength(1)
  })
  it('membre d\'un workspace: el prefix no és una porta del darrere (cap altre script; cap #, ;, |, cadena de && ni salt de línia)', () => {
    const scripts = (name: string, value: string) => ({ ...good, scripts: { ...good.scripts, [name]: value } })
    const member = { member: true }
    expect(checkPackageJson(scripts('seed', 'echo # && cmd seed'), template, '0.1.0', member)).toEqual([{ check: 'package.json', detail: 'scripts.seed és «echo # && cmd seed», la plantilla diu «cmd seed»' }])
    expect(checkPackageJson(scripts('build', 'exit 0; true && cmd build'), template, '0.1.0', member)).toHaveLength(1)
    expect(checkPackageJson(scripts('build', 'node x.mjs && cmd build'), template, '0.1.0', member)).toHaveLength(1)
    for (const prefix of ['echo #', 'exit 0; true', 'node a.mjs | cat', 'node a.mjs && node b.mjs', 'node a.mjs\nexit 0', 'node a.mjs || true', '$(exit 0)', 'node `x`', ''])
      expect(checkPackageJson(scripts('preseed', `${prefix} && cmd preseed`), template, '0.1.0', member), JSON.stringify(prefix)).toHaveLength(1)
  })
  it('el motor tampoc a optionalDependencies ni peerDependencies, ni en un membre a la versió exacta del nucli', () => {
    const engineVersions = { next: '16.3.3', react: '19.2.6' }
    expect(checkPackageJson({ ...good, optionalDependencies: { next: '16.3.3' } }, template, '0.1.0')).toEqual([{ check: 'package.json', detail: 'optionalDependencies declara next: el porta el nucli; treu-lo' }])
    expect(checkPackageJson({ ...good, peerDependencies: { react: '19.2.6', sharp: '0.35.4' } }, template, '0.1.0')).toEqual([{ check: 'package.json', detail: 'peerDependencies declara react: el porta el nucli; treu-lo' }])
    expect(checkPackageJson({ ...good, optionalDependencies: { next: '16.3.3' }, peerDependencies: { react: '19.2.6' } }, template, '0.1.0', { engineVersions, member: true })).toHaveLength(2)
  })
  it('overrides, resolutions i pnpm.overrides que re-fixen el motor (qualsevol forma de clau), sempre; els d\'altres paquets, no', () => {
    const detail = (field: string, name: string, key: string) => ({ check: 'package.json', detail: `${field} re-fixa ${name} («${key}»): el porta el nucli; treu-lo` })
    expect(checkPackageJson({ ...good, overrides: { next: '16.3.2', sharp: '0.35.0' } }, template, '0.1.0')).toEqual([detail('overrides', 'next', 'next')])
    expect(checkPackageJson({ ...good, overrides: { foo: { 'react-dom': '19.0.0' }, 'payload@3': '3.0.0' } }, template, '0.1.0')).toEqual([detail('overrides', 'react-dom', 'foo > react-dom'), detail('overrides', 'payload', 'payload@3')])
    expect(checkPackageJson({ ...good, resolutions: { '**/@payloadcms/ui': '3.0.0', 'foo/graphql': '16.0.0', 'next-sitemap': '4.0.0' } }, template, '0.1.0')).toEqual([detail('resolutions', '@payloadcms/ui', '**/@payloadcms/ui'), detail('resolutions', 'graphql', 'foo/graphql')])
    expect(checkPackageJson({ ...good, pnpm: { overrides: { 'foo>tailwindcss': '4.0.0', '@tailwindcss/postcss@4': '4.0.0', '@scope/next': '1.0.0' } } }, template, '0.1.0')).toEqual([detail('pnpm.overrides', 'tailwindcss', 'foo>tailwindcss'), detail('pnpm.overrides', '@tailwindcss/postcss', '@tailwindcss/postcss@4')])
    // Una etiqueta o un rang a la clau no és cap paquet: «sharp@next» és sharp; «@payloadcms/ui@3» és @payloadcms/ui
    expect(checkPackageJson({ ...good, overrides: { 'sharp@next': '0.35.4' }, pnpm: { overrides: { 'foo@next>sharp': '0.35.4' } } }, template, '0.1.0')).toEqual([])
    expect(checkPackageJson({ ...good, pnpm: { overrides: { '@payloadcms/ui@3': '3.0.0', 'foo@latest>next@16': '16.3.3' } } }, template, '0.1.0')).toEqual([detail('pnpm.overrides', '@payloadcms/ui', '@payloadcms/ui@3'), detail('pnpm.overrides', 'next', 'foo@latest>next@16')])
    // En un membre també: cap override és una dependència declarada a la versió del nucli
    expect(checkPackageJson({ ...good, pnpm: { overrides: { next: '16.3.3' } } }, template, '0.1.0', { engineVersions: { next: '16.3.3' }, member: true })).toEqual([detail('pnpm.overrides', 'next', 'next')])
  })
})
describe('checkPackageJson: pnpm.packageExtensions', () => {
  const template = { engines: { node: '>=24' }, packageManager: 'pnpm@10.33.0', scripts: Object.fromEntries(CORE_SCRIPTS.map((s) => [s, `cmd ${s}`])), type: 'module' }
  const good = { dependencies: { '@suburlabs/core': '0.1.0' }, engines: { node: '>=24' }, packageManager: 'pnpm@10.33.0', scripts: template.scripts, type: 'module' }
  it('un paquet del motor afegit a dependencies, peerDependencies o optionalDependencies d\'un altre: re-fixat, també en un membre', () => {
    const detail = (name: string, key: string) => ({ check: 'package.json', detail: `pnpm.packageExtensions re-fixa ${name} («${key}»): el porta el nucli; treu-lo` })
    const packageExtensions = { 'foo@1': { dependencies: { next: '16.3.3', sharp: '0.35.4' }, peerDependencies: { react: '*' } }, bar: { optionalDependencies: { '@payloadcms/ui': '3.89.0' } }, baz: { dependencies: { 'next-sitemap': '4.2.3' } } }
    const expected = [detail('next', 'foo@1'), detail('react', 'foo@1'), detail('@payloadcms/ui', 'bar')]
    expect(checkPackageJson({ ...good, pnpm: { packageExtensions } }, template, '0.1.0')).toEqual(expected)
    expect(checkPackageJson({ ...good, pnpm: { packageExtensions } }, template, '0.1.0', { engineVersions: { next: '16.3.3' }, member: true })).toEqual(expected)
    expect(checkPackageJson({ ...good, pnpm: { packageExtensions: { baz: { dependencies: { sharp: '0.35.4' } } } } }, template, '0.1.0')).toEqual([])
  })
})
describe('checkGitignore', () => {
  it('cada línia obligatòria (escapada)', () => {
    expect(checkGitignore(REQUIRED_GITIGNORE.join('\n'))).toEqual([])
    expect(checkGitignore(REQUIRED_GITIGNORE.filter((l) => l !== 'src/proxy.ts').join('\n'))).toEqual([{ check: '.gitignore', detail: 'falta la línia «src/proxy.ts»' }])
    expect(checkGitignore(REQUIRED_GITIGNORE.map((l) => l.replace(/\\/g, '')).join('\n')).length).toBeGreaterThan(0)   // sense escapar no val
    expect(checkGitignore(null)).toHaveLength(1)
  })
})
describe('checkExactFiles', () => {
  const templates = [{ clientPath: 'Dockerfile', text: 'FROM x\n# {{slug}}\n' }]
  const vars = { coreVersion: '0.1.0', domain: 'd.example', locale: 'ca' as const, name: 'N', slug: 's' }
  it('igual, diferent, absent, sense plantilla', () => {
    expect(checkExactFiles(() => 'FROM x\n# s\n', templates, vars, ['Dockerfile'], 'U')).toEqual([])
    expect(checkExactFiles(() => 'FROM y\n', templates, vars, ['Dockerfile'], 'U')[0].detail).toMatch(/Dockerfile no és la plantilla .*\(U\)/)
    expect(checkExactFiles(() => null, templates, vars, ['Dockerfile'], 'U')[0].detail).toMatch(/falta Dockerfile/)
    expect(checkExactFiles(() => 'x', templates, vars, ['tsconfig.json'], 'U')[0].detail).toMatch(/no té plantilla/)
  })
})
