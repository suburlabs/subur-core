// core/packages/core/tests/int/templates.int.spec.ts — les plantilles (spec §4.2; pla E2, R2, R5, R6, R22)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { APP_FILES, COPIED_FILES, EXACT_FILES, GENERATED_FILES, gitignoreLine, IMPORT_MAP, isEnginePackage, REQUIRED_GITIGNORE } from '../../src/templates/files.js'
import { clientPathOf, readClientTemplates, readGenerated, renderTemplate, TEMPLATES_DIR, templatePathOf, type TemplateVars } from '../../src/templates/render.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO = path.join(PKG, '../../examples/demo')
const version = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version
const demoVars: TemplateVars = { coreVersion: version, domain: 'demo.example', locale: 'ca', name: 'Reformes Exemple', slug: 'demo' }
const VAR = /\{\{[a-zA-Z]+\}\}/
const template = (clientPath: string) => readClientTemplates().find((t) => t.clientPath === clientPath)!.text
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }

describe('templates/ (spec §4.2)', () => {
  it('generated/ és exactament GENERATED_FILES (en tots dos sentits, ordre lexicogràfic)', () => {
    expect(readGenerated().map((t) => t.clientPath)).toEqual([...GENERATED_FILES].sort())
  })
  it('client/ és exactament EXACT_FILES ∪ COPIED_FILES', () => {
    expect(readClientTemplates().map((t) => t.clientPath)).toEqual([...EXACT_FILES, ...COPIED_FILES].sort())
  })
  it('els camins: _ inicial ↔ . inicial, a qualsevol segment, i res més', () => {
    expect(clientPathOf('_github/workflows/image.yml')).toBe('.github/workflows/image.yml')
    expect(clientPathOf('src/subur-env.d.ts')).toBe('src/subur-env.d.ts')
    for (const f of [...EXACT_FILES, ...COPIED_FILES]) expect(clientPathOf(templatePathOf(f))).toBe(f)
    expect(existsSync(path.join(TEMPLATES_DIR, 'client/_gitignore'))).toBe(true)
  })
  it('renderTemplate substitueix les cinc variables, i només aquestes', () => {
    expect(renderTemplate('{{slug}}|{{domain}}|{{name}}|{{locale}}|{{coreVersion}}|${{ vars.SITE_URL }}', demoVars)).toBe('demo|demo.example|Reformes Exemple|ca|' + version + '|${{ vars.SITE_URL }}')
    expect(() => renderTemplate('{{foo}}', demoVars)).toThrow(/variable desconeguda \{\{foo\}\}/)
  })
  it('cap plantilla deixa cap {{variable}} un cop renderitzada; generated/ no en té cap', () => {
    for (const t of readClientTemplates()) expect(renderTemplate(t.text, demoVars), t.clientPath).not.toMatch(VAR)
    for (const t of readGenerated()) expect(t.text, t.clientPath).not.toMatch(VAR)
  })
  it('image.yml fixa el workflow a la versió exacta, un sol cop, i porta concurrency per ref', () => {
    const yml = renderTemplate(template('.github/workflows/image.yml'), demoVars)
    expect(yml.match(/uses: suburlabs\/subur-core\/\.github\/workflows\/client-image\.yml@v\d+\.\d+\.\d+/g)).toEqual([`uses: suburlabs/subur-core/.github/workflows/client-image.yml@v${version}`])
    expect(yml).toMatch(/^concurrency:\n {2}group: image-\$\{\{ github\.ref \}\}/m)
  })
  it('.gitignore de la plantilla porta cada línia obligatòria (generats i importMap escapats, els tres .env*.example designorats)', () => {
    const lines = template('.gitignore').split('\n')
    for (const line of REQUIRED_GITIGNORE) expect(lines, line).toContain(line)
    expect(gitignoreLine('src/app/(frontend)/[locale]/page.tsx')).toBe('src/app/(frontend)/\\[locale\\]/page.tsx')
  })
  it('.dockerignore de la plantilla porta cada generat i l\'importMap, escapats (una còpia local vella no entra a la imatge; R22)', () => {
    const lines = template('.dockerignore').split('\n')
    for (const f of [...GENERATED_FILES, IMPORT_MAP]) expect(lines, f).toContain(gitignoreLine(f))
  })
  it('_npmrc de la plantilla hissa els mateixos 9 patrons que el .npmrc del workspace (R3)', () => {
    const patternsOf = (npmrc: string) => [...npmrc.matchAll(/^public-hoist-pattern\[\]=(\S+)$/gm)].map((m) => m[1])
    expect(patternsOf(template('.npmrc'))).toEqual(patternsOf(readFileSync(path.join(PKG, '../../.npmrc'), 'utf8')))
    expect(patternsOf(template('.npmrc'))).toHaveLength(9)
  })
  it('git de debò ignora cada generat amb el .gitignore de la plantilla, i no ignora una ruta pròpia del client (canari; ronda 1 T1)', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'subur-gitignore-'))
    try {
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo, env: gitEnv })
      writeFileSync(path.join(repo, '.gitignore'), template('.gitignore'))
      const touch = (f: string) => { mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); writeFileSync(path.join(repo, f), '') }
      for (const g of [...GENERATED_FILES, IMPORT_MAP]) touch(g)
      const canaries = ['src/app/(frontend)/a/page.tsx', 'src/app/(frontend)/l/page.tsx', 'src/app/(subur)/custom.scss', 'src/site/site.config.ts', '.env.example', '.env.docker.example', '.env.backup.example', 'vendor/README.md']
      for (const canary of canaries) touch(canary)
      // check-ignore no admet --literal-pathspecs (128) i compara el camí literalment; --no-index perquè res no és a l'índex
      const ignored = (f: string) => { const r = spawnSync('git', ['check-ignore', '-q', '--no-index', '--', f], { cwd: repo, env: gitEnv }); expect(r.status, `${f}: codi ${r.status}`).not.toBe(128); return r.status === 0 }
      for (const g of [...GENERATED_FILES, IMPORT_MAP]) expect(ignored(g), `${g} ignorat`).toBe(true)
      for (const canary of canaries) expect(ignored(canary), `${canary} no ignorat`).toBe(false)
      expect(ignored('node_modules/x')).toBe(true)   // control positiu de l'ajudant
    } finally {
      rmSync(repo, { force: true, recursive: true })
    }
  })
  it('package.json de la plantilla: cap paquet del motor, el nucli a {{coreVersion}}, versions exactes, els scripts del contracte', () => {
    const pkg = JSON.parse(renderTemplate(template('package.json'), demoVars)) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string> }
    expect(pkg.dependencies['@suburlabs/core']).toBe(version)
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(isEnginePackage(name), name).toBe(false)
      expect(v, name).toMatch(/^\d+\.\d+\.\d+$/)
    }
    expect(pkg.scripts).toMatchObject({ check: 'subur check', gate: 'subur gate', lint: 'eslint .', migrate: 'subur migrate', prebuild: 'subur sync', predev: 'subur sync', typecheck: 'tsc --noEmit' })
  })
  it('isEnginePackage', () => {
    for (const n of ['next', 'react', 'react-dom', 'payload', 'tailwindcss', 'eslint-config-next', 'graphql', '@payloadcms/ui', '@tailwindcss/postcss']) expect(isEnginePackage(n), n).toBe(true)
    for (const n of ['@suburlabs/core', 'next-sitemap', 'sharp', 'typescript', '@types/react', 'eslint', 'cross-env']) expect(isEnginePackage(n), n).toBe(false)
  })
  it('el layout generat exporta viewport (i metadata) de createLocaleLayout, i no en defineix cap altre (abans themeColor.int.spec de la demo)', () => {
    const layout = readGenerated().find((t) => t.clientPath === 'src/app/(frontend)/[locale]/layout.tsx')!.text
    expect(layout).toMatch(/const\s*\{[^}]*\bviewport\b[^}]*\}\s*=\s*createLocaleLayout\(/)
    expect(layout).toMatch(/export\s*\{[^}]*\bviewport\b[^}]*\}/)
    expect(layout).not.toMatch(/export\s+(const|let|var|function|async\s+function)\s+(viewport|generateViewport)\b/)
  })
  it('la demo té les plantilles exactes de l\'app renderitzades amb els seus fets, byte a byte (paritat; R4)', () => {
    for (const f of APP_FILES) expect(readFileSync(path.join(DEMO, f), 'utf8'), f).toBe(renderTemplate(template(f), demoVars))
  })
  // Les línies CLAU=valor com les llegeix ops (scripts/ops/sops.ts, NAME_LINE): la clau pot dur xifres (S3_*, BACKUP_S3_*)
  const NAME_LINE = /^[A-Z][A-Z0-9_]*=/
  const envLines = (text: string) => text.split('\n').filter((l) => NAME_LINE.test(l))
  it('.env.docker.example i .env.backup.example de la plantilla: cap secret, només els quatre valors per defecte legítims (R11)', () => {
    expect(envLines(template('.env.docker.example'))).toHaveLength(20)
    expect(envLines(template('.env.backup.example'))).toHaveLength(3)
    for (const tpl of ['.env.docker.example', '.env.backup.example', '.env.example']) for (const line of envLines(template(tpl))) expect(line, `${tpl}: ${line}`).toMatch(/^[A-Z][A-Z0-9_]*=$|^IMAGE_TAG=latest$|^SITE_DOMAIN=localhost$|^NEXT_PUBLIC_SERVER_URL=https?:\/\/localhost(:3000)?$|^MEDIA_STORAGE=s3$|^DATABASE_URL=postgres:\/\/subur:subur@127\.0\.0\.1:5432\/subur_\{\{slug\}\}$|^SUBUR_ADMIN_EMAIL=admin@\{\{domain\}\}$|^(SUBUR_SECRET|PREVIEW_SECRET|SUBUR_ADMIN_PASSWORD)=local-only(-password)?$/)
  })
  // Només en aquest repositori (l'arrel és tres nivells amunt de packages/core; al repositori públic no hi és i la prova s'omet)
  const ROOT = path.resolve(PKG, '../../..')
  it.skipIf(!existsSync(path.join(ROOT, '.env.docker.example')))('.env.docker.example i .env.backup.example: les mateixes línies CLAU=valor que els de l\'arrel, en el mateix ordre', () => {
    for (const f of ['.env.docker.example', '.env.backup.example']) expect(envLines(template(f)), f).toEqual(envLines(readFileSync(path.join(ROOT, f), 'utf8')))
  })
})
