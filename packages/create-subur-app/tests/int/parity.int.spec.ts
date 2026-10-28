// core/packages/create-subur-app/tests/int/parity.int.spec.ts — la CLI i la seva bastida, iguals al nucli i a la demo
// La CLI no depèn del nucli: el que se n'ha de saber (plantilles, claus, generats) es llegeix com a text.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { NPMRC, WORKSPACE_YAML } from '../../src/bootstrap.js'
import { KEYS, render, RENDERED, type Vars } from '../../src/render.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.resolve(here, '../../../core')
const DEMO = path.resolve(here, '../../../../examples/demo')
const SCAFFOLD = path.resolve(here, '../../scaffold')
const walk = (dir: string, base = dir): string[] => readdirSync(dir).filter((e) => e !== '.DS_Store').sort().flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e), base) : [path.relative(base, path.join(dir, e))]))
const quoted = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1])
const demoVars: Vars = { coreVersion: '0.0.0', domain: 'demo.example', locale: 'ca', name: 'Reformes Exemple', slug: 'demo' }

describe('bootstrap i render: els del nucli', () => {
  it('NPMRC és, byte a byte, templates/client/_npmrc', () => {
    expect(NPMRC).toBe(readFileSync(path.join(CORE, 'templates/client/_npmrc'), 'utf8'))
  })

  it('WORKSPACE_YAML és, byte a byte, templates/client/pnpm-workspace.yaml', () => {
    expect(WORKSPACE_YAML).toBe(readFileSync(path.join(CORE, 'templates/client/pnpm-workspace.yaml'), 'utf8'))
  })

  it('KEYS són les TEMPLATE_KEYS del nucli', () => {
    const m = /export const TEMPLATE_KEYS[^=]*=\s*\[([^\]]+)\]/.exec(readFileSync(path.join(CORE, 'src/templates/render.ts'), 'utf8'))
    expect(m, 'TEMPLATE_KEYS a src/templates/render.ts del nucli').not.toBeNull()
    expect([...KEYS]).toEqual(quoted(m![1]))
  })

  it('render: les claus conegudes es substitueixen; una de desconeguda és un error', () => {
    expect(render('{{name}} · {{domain}}', demoVars)).toBe('Reformes Exemple · demo.example')
    expect(() => render('{{nom}}', demoVars)).toThrow(/variable desconeguda \{\{nom\}\}/)
  })
})

describe('la bastida', () => {
  const tracked = execFileSync('git', ['ls-files', '--', 'src/site', 'public/site'], { cwd: DEMO, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
  const site = [...walk(path.join(SCAFFOLD, 'src/site')).map((f) => `src/site/${f}`), ...walk(path.join(SCAFFOLD, 'public/site')).map((f) => `public/site/${f}`)].sort()

  it('src/site/ i public/site/ són els fitxers versionats de la demo (git ls-files), cap més', () => {
    expect(tracked.length).toBeGreaterThan(0)
    expect(site).toEqual(tracked)
  })

  it('byte a byte iguals als de la demo; els de RENDERED, renderitzats amb els fets de la demo', () => {
    for (const f of site) {
      const scaffold = readFileSync(path.join(SCAFFOLD, f))
      const demo = readFileSync(path.join(DEMO, f))
      if (RENDERED.includes(f)) expect(render(scaffold.toString('utf8'), demoVars), f).toBe(demo.toString('utf8'))
      else expect(scaffold.equals(demo), f).toBe(true)
    }
  })

  it('cap fitxer generat del nucli (GENERATED_FILES i el mapa d\'imports)', () => {
    const files = readFileSync(path.join(CORE, 'src/templates/files.ts'), 'utf8')
    const generated = /export const GENERATED_FILES = \[([\s\S]*?)\n\] as const/.exec(files)
    const importMap = /export const IMPORT_MAP = '([^']+)'/.exec(files)
    expect(generated && importMap).toBeTruthy()
    const all = [...quoted(generated![1]), importMap![1]]
    expect(all.length).toBeGreaterThan(10)
    for (const f of all) expect(existsSync(path.join(SCAFFOLD, f)), f).toBe(false)
  })

  it('el seed conserva els marcadors del formulari; fora de RENDERED, cap clau de plantilla', () => {
    for (const locale of ['ca', 'es', 'en']) expect(readFileSync(path.join(SCAFFOLD, `src/site/seed/content/${locale}.ts`), 'utf8'), locale).toContain('{{nom}}')
    const keys = new RegExp(`\\{\\{(?:${KEYS.join('|')})\\}\\}`)
    const all = walk(SCAFFOLD)
    for (const f of RENDERED) expect(all, f).toContain(f)
    for (const f of all.filter((f) => !RENDERED.includes(f))) expect(keys.test(readFileSync(path.join(SCAFFOLD, f), 'latin1')), f).toBe(false)
  })

  it('legalSlugs de la configuració renderitzada (ca i es) són pàgines del contingut de mostra', () => {
    const pageSlugs = /export const pageSlugs = \[([^\]]+)\]/.exec(readFileSync(path.join(SCAFFOLD, 'src/site/seed/content/index.ts'), 'utf8'))
    expect(pageSlugs).not.toBeNull()
    const pages = quoted(pageSlugs![1])
    for (const locale of ['ca', 'es'] as const) {
      const config = render(readFileSync(path.join(SCAFFOLD, 'src/site/site.config.ts'), 'utf8'), { ...demoVars, locale })
      const legal = /legalSlugs:\s*\{([^}]+)\}/.exec(config)
      expect(legal, locale).not.toBeNull()
      const slugs = quoted(legal![1])
      expect(slugs).toHaveLength(3)
      for (const s of slugs) expect(pages, `${locale}: ${s}`).toContain(s)
    }
  })

  it('vendor/README.md és el de la demo', () => {
    expect(readFileSync(path.join(SCAFFOLD, 'vendor/README.md'), 'utf8')).toBe(readFileSync(path.join(DEMO, 'vendor/README.md'), 'utf8'))
  })
})
