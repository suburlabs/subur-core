// core/packages/core/tests/int/check.int.spec.ts — `subur check` sobre un client de prova complet (spec §4.1; pla E2, R5)
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { readClientTemplates, renderTemplate, type TemplateVars } from '../../src/templates/render.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEMO = path.join(PKG, '../../examples/demo')
const corePkg = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; version: string }
// Els fets de la demo: el site.config.ts del client de prova és el seu (els colors del tema casen)
const demoVars: TemplateVars = { coreVersion: corePkg.version, domain: 'demo.example', locale: 'ca', name: 'Reformes Exemple', slug: 'demo' }
// Sense la configuració de git de la màquina (un excludesFile global canviaria què és ignorat) i sense base ni secret: check no en
// necessita, i sync en posa de mentida.
const { DATABASE_URL: _db, SUBUR_SECRET: _secret, ...envSense } = process.env
const env = { ...(envSense as NodeJS.ProcessEnv), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
// A la fondària de tests/fixtures/app (engineBin troba el motor pujant fins a packages/core/node_modules) i ignorat (**/.tmp-app-*/)
const app = mkdtempSync(path.join(PKG, 'tests/fixtures/.tmp-app-check-'))
const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@subur.dev', ...args], { cwd: app, encoding: 'utf8', env })
const subur = (args: string[], cwd = app) => spawnSync(process.execPath, [path.join(PKG, 'bin/subur.js'), ...args], { cwd, encoding: 'utf8', env })
const file = (f: string) => path.join(app, f)
const edit = (f: string, change: (text: string) => string) => {
  const before = readFileSync(file(f), 'utf8')
  const after = change(before)
  expect(after, `${f}: la mutació no canvia res`).not.toBe(before)
  writeFileSync(file(f), after)
}
const checkout = (f: string) => git('checkout', '--', f)
const linesOf = (text: string, prefix: string) => text.split('\n').filter((l) => l.startsWith(prefix))

beforeAll(() => {
  for (const { clientPath, text } of readClientTemplates()) {
    mkdirSync(path.dirname(file(clientPath)), { recursive: true })
    writeFileSync(file(clientPath), renderTemplate(text, demoVars))
  }
  for (const f of ['src/site/site.config.ts', 'src/site/theme.css', 'next.config.ts']) cpSync(path.join(DEMO, f), file(f))
  mkdirSync(file('vendor'))
  writeFileSync(file('vendor/README.md'), 'Tarballs del nucli\n')
  // Amb un package.json propi, l'autoreferència a @suburlabs/core es perd (sonda S15): l'enllaç la torna
  mkdirSync(file('node_modules/@suburlabs'), { recursive: true })
  symlinkSync(PKG, file('node_modules/@suburlabs/core'), 'dir')
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: app, env })
  git('add', '-A')
  git('commit', '-q', '-m', 'client de prova')
  const r = subur(['sync'])
  expect(r.status, r.stderr).toBe(0)
}, 120_000)
afterAll(() => rmSync(app, { force: true, recursive: true }))

describe('subur check', { timeout: 120_000 }, () => {
  // La protecció real contra operar sobre el repositori de fora, i la línia de base: una restauració a mitges no queda amagada
  beforeEach(() => {
    expect(realpathSync(git('rev-parse', '--show-toplevel').trim())).toBe(realpathSync(app))
    const r = subur(['check'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^check: ok \(11 comprovacions\)$/m)
  }, 120_000)

  it('línia de base: un client a l\'arrel del seu repositori passa les 11, sense cap fitxer omès', () => {
    const r = subur(['check'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^check: ok \(11 comprovacions\)$/m)
    expect(r.stdout).not.toMatch(/membre d'un workspace/)
    expect(r.stderr).toBe('')
  })

  it('(a) next a dependencies, fins i tot a la versió exacta del nucli: a l\'arrel no és cap membre', () => {
    edit('package.json', (t) => { const pkg = JSON.parse(t); pkg.dependencies.next = corePkg.dependencies.next; return `${JSON.stringify(pkg, null, 2)}\n` })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: dependencies declara next: /m)
    } finally {
      checkout('package.json')
    }
  })

  it('(a2) @suburlabs/core: workspace:* a l\'arrel', () => {
    edit('package.json', (t) => { const pkg = JSON.parse(t); pkg.dependencies['@suburlabs/core'] = 'workspace:*'; return `${JSON.stringify(pkg, null, 2)}\n` })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: @suburlabs\/core és «workspace:\*»/m)
    } finally {
      checkout('package.json')
    }
  })

  it('(b) una línia de més al Dockerfile: no és la plantilla, amb la pista d\'update', () => {
    edit('Dockerfile', (t) => `${t}RUN echo editat\n`)
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: plantilla: Dockerfile no és la plantilla de la versió instal·lada \(pnpm install && pnpm exec subur update\)$/m)
    } finally {
      checkout('Dockerfile')
    }
  })

  it('(b2) subur update: un Dockerfile editat i commitejat es reescriu, es veu al diff i check torna a passar; sense canvis, ho diu', () => {
    edit('Dockerfile', (t) => `${t}RUN echo editat\n`)
    // Commitejat: si no, l'arbre reescrit torna a ser igual que HEAD i el diff --stat és buit
    git('commit', '-qam', 'mut')
    try {
      const r = subur(['update'])
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toMatch(/^subur update: 1 fitxers reescrits$/m)
      expect(r.stdout).toMatch(/^ {2}Dockerfile$/m)
      expect(r.stdout).toMatch(/^ 1 file changed/m)
      expect(readFileSync(file('Dockerfile'), 'utf8')).not.toContain('RUN echo editat')
      const c = subur(['check'])
      expect(c.status, c.stderr).toBe(0)
      const again = subur(['update'])
      expect(again.status, again.stderr).toBe(0)
      expect(again.stdout).toMatch(/^subur update: cap canvi/m)
    } finally {
      git('reset', '-q', '--hard', 'HEAD~1')
    }
  })

  it('(b3) subur update: torna a posar la línia de src/proxy.ts al .gitignore i el script lint', () => {
    edit('.gitignore', (t) => t.split('\n').filter((l) => l !== 'src/proxy.ts').join('\n'))
    edit('package.json', (t) => { const pkg = JSON.parse(t); delete pkg.scripts.lint; return `${JSON.stringify(pkg, null, 2)}\n` })
    try {
      expect(subur(['check']).status).toBe(1)
      const r = subur(['update'])
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toMatch(/^subur update: 2 fitxers reescrits$/m)
      expect(r.stdout).toMatch(/^ {2}\.gitignore$/m)
      expect(r.stdout).toMatch(/^ {2}package\.json$/m)
      expect(readFileSync(file('.gitignore'), 'utf8')).toMatch(/^src\/proxy\.ts$/m)
      expect((JSON.parse(readFileSync(file('package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts.lint).toBe('eslint .')
      const c = subur(['check'])
      expect(c.status, c.stderr).toBe(0)
    } finally {
      git('checkout', '--', '.gitignore', 'package.json')
    }
  })

  it('update amb arguments és un error d\'ús (codi 2)', () => {
    expect(subur(['update', '--force']).status).toBe(2)
  })

  it('(c) un generat versionat (git add -f)', () => {
    git('add', '-f', '--', 'src/proxy.ts')
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: generats: src\/proxy\.ts està versionat/m)
    } finally {
      git('--literal-pathspecs', 'rm', '--cached', '-q', '--', 'src/proxy.ts')
    }
  })

  it('(d) el .gitignore sense la línia de src/proxy.ts', () => {
    edit('.gitignore', (t) => t.split('\n').filter((l) => l !== 'src/proxy.ts').join('\n'))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: \.gitignore: falta la línia «src\/proxy\.ts»$/m)
      expect(r.stderr).toMatch(/^check: generats: git no ignora src\/proxy\.ts/m)
    } finally {
      checkout('.gitignore')
    }
  })

  it('(e) un generat que falta', () => {
    rmSync(file('src/proxy.ts'))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: generats: falta src\/proxy\.ts: executa subur sync$/m)
    } finally {
      const s = subur(['sync'])
      expect(s.status, s.stderr).toBe(0)
    }
  })

  it('(f) un .gitignore sense escapar els claudàtors: git no ignora el layout', () => {
    edit('.gitignore', (t) => t.replace(/\\([[\]])/g, '$1'))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('check: generats: git no ignora src/app/(frontend)/[locale]/layout.tsx')
      expect(r.stderr).toMatch(/^check: \.gitignore: falta la línia /m)
    } finally {
      checkout('.gitignore')
    }
  })

  it('(g) theme.css sense --foreground al :root: tokens, i cap themeColor', () => {
    edit('src/site/theme.css', (t) => t.replace(/^ {2}--foreground: [^;]+;\n/m, ''))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: tokens: theme\.css no defineix --foreground al :root clar/m)
      expect(r.stderr).not.toMatch(/^check: themeColor:/m)
    } finally {
      checkout('src/site/theme.css')
    }
  })

  it('(h) themeColor.light que no és el fons de :root', () => {
    edit('src/site/site.config.ts', (t) => t.replace(/light: '#[0-9a-f]{6}'/, "light: '#000000'"))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: themeColor: themeColor\.light \(#000000\)/m)
    } finally {
      checkout('src/site/site.config.ts')
    }
  })

  it('(i) src/site/** (.ts i .tsx) que importa un subcamí que no és de l\'API del client; el run.ts generat no compta', () => {
    mkdirSync(file('src/site/seed/content'), { recursive: true })
    writeFileSync(file('src/site/seed/content/ca.ts'), "import { buildSuburConfig } from '@suburlabs/core/config'\n\nexport const x = buildSuburConfig\n")
    writeFileSync(file('src/site/Hero.tsx'), "import { getPayload } from 'payload'\n\nexport const Hero = () => <p>{String(getPayload)}</p>\n")
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(linesOf(r.stderr, 'check: imports:')).toEqual([
        expect.stringMatching(/^check: imports: src\/site\/Hero\.tsx importa «payload»/),
        expect.stringMatching(/^check: imports: src\/site\/seed\/content\/ca\.ts importa «@suburlabs\/core\/config»/),
      ])
      expect(r.stderr).not.toMatch(/run\.ts importa/)
    } finally {
      rmSync(file('src/site/seed/content/ca.ts'))
      rmSync(file('src/site/Hero.tsx'))
    }
  })

  it('(j) next.config.ts amb withPayload: els dos problemes', () => {
    writeFileSync(file('next.config.ts'), "import { withPayload } from '@payloadcms/next/withPayload'\n\nexport default withPayload({})\n")
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(linesOf(r.stderr, 'check: next.config:')).toHaveLength(2)
    } finally {
      checkout('next.config.ts')
    }
  })

  it('(k) .npmrc amb un patró de menys: a l\'arrel els fitxers de repositori sí que es comproven', () => {
    edit('.npmrc', (t) => t.replace(/^public-hoist-pattern\[\]=\S+\n/m, ''))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: plantilla: \.npmrc no és la plantilla/m)
    } finally {
      checkout('.npmrc')
    }
  })

  it('(l) image.yml fixat a una altra versió', () => {
    edit('.github/workflows/image.yml', (t) => t.replace(/client-image\.yml@v\d+\.\d+\.\d+/, 'client-image.yml@v9.9.9'))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: plantilla: \.github\/workflows\/image\.yml no és la plantilla/m)
    } finally {
      checkout('.github/workflows/image.yml')
    }
  })

  it('(m) sense vendor/', () => {
    rmSync(file('vendor'), { force: true, recursive: true })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: vendor: falta el directori vendor\//m)
    } finally {
      mkdirSync(file('vendor'))
      writeFileSync(file('vendor/README.md'), 'Tarballs del nucli\n')
    }
  })

  it('(o) sense src/site/site.config.ts: el problema, sense traça, i la resta de comprovacions corren igual', () => {
    rmSync(file('src/site/site.config.ts'))
    rmSync(file('vendor'), { force: true, recursive: true })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: site\.config: falta src\/site\/site\.config\.ts$/m)
      expect(r.stderr).toMatch(/^check: vendor: falta el directori vendor\//m)   // (11), que no en depèn
      expect(r.stdout).toMatch(/^check: sense site\.config: /m)
      expect(r.stderr).not.toMatch(/^\s+at /m)
    } finally {
      checkout('src/site/site.config.ts')
      mkdirSync(file('vendor'))
      writeFileSync(file('vendor/README.md'), 'Tarballs del nucli\n')
    }
  })

  it('(o2) sense tsconfig.json: site.config no es carrega, i la (2) diu igualment que falta la plantilla', () => {
    rmSync(file('tsconfig.json'))
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: site\.config: no es pot carregar src\/site\/site\.config\.ts: /m)
      expect(r.stderr).toMatch(/^check: plantilla: falta tsconfig\.json \(pnpm install && pnpm exec subur update\)$/m)
      expect(r.stderr).not.toMatch(/^\s+at /m)
    } finally {
      checkout('tsconfig.json')
    }
  })

  it('(p) un package.json que no és JSON: el problema, sense traça', () => {
    writeFileSync(file('package.json'), '{ "name": ')
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: JSON invàlid: /m)
      expect(r.stderr).not.toMatch(/^\s+at /m)
    } finally {
      checkout('package.json')
    }
  })

  it('(p2) un package.json que és JSON però no un objecte (null, []): el problema, sense traça', () => {
    for (const text of ['null\n', '[]\n']) {
      writeFileSync(file('package.json'), text)
      try {
        const r = subur(['check'])
        expect(r.status, text).toBe(1)
        expect(r.stderr, text).toMatch(/^check: package\.json: JSON invàlid: no és un objecte$/m)
        expect(r.stderr, text).not.toMatch(/^\s+at /m)
      } finally {
        checkout('package.json')
      }
    }
  })

  it('(r) sense scripts.preseed: un clon fresc no tindria run.ts al seed', () => {
    edit('package.json', (t) => { const pkg = JSON.parse(t); delete pkg.scripts.preseed; return `${JSON.stringify(pkg, null, 2)}\n` })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: scripts\.preseed és «absent», la plantilla diu «subur sync»$/m)
    } finally {
      checkout('package.json')
    }
  })

  it('(s) pnpm.overrides.next: re-fixar el motor per la porta del darrere', () => {
    edit('package.json', (t) => { const pkg = JSON.parse(t); pkg.pnpm = { overrides: { next: corePkg.dependencies.next } }; return `${JSON.stringify(pkg, null, 2)}\n` })
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: pnpm\.overrides re-fixa next \(«next»\): /m)
    } finally {
      checkout('package.json')
    }
  })

  it('(t) un .pnpmfile.cjs a l\'arrel: reescriu dependències en instal·lar', () => {
    writeFileSync(file('.pnpmfile.cjs'), 'module.exports = { hooks: {} }\n')
    try {
      const r = subur(['check'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: \.pnpmfile\.cjs a l'arrel del client: /m)
    } finally {
      rmSync(file('.pnpmfile.cjs'))
    }
  })

  it('(q) un enllaç simbòlic penjat a src/site/ no és una font del client: no trenca el recorregut', () => {
    symlinkSync('no-existeix.ts', file('src/site/penjat.ts'))
    try {
      const r = subur(['check'])
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toMatch(/^check: ok \(11 comprovacions\)$/m)
    } finally {
      rmSync(file('src/site/penjat.ts'))
    }
  })

  it('(n) fora d\'un repositori git: codi 1, i res més no s\'avalua', () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), 'subur-check-empty-'))
    try {
      const r = subur(['check'], empty)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: git: el client ha de ser un repositori git$/m)
      expect(r.stdout).not.toMatch(/comprovacions/)
    } finally {
      rmSync(empty, { force: true, recursive: true })
    }
  })

  it('check amb arguments és un error d\'ús (codi 2)', () => {
    expect(subur(['check', '--fix']).status).toBe(2)
  })
})

// Un membre d'un workspace: el client és un subdirectori del repositori (com la demo). Mateix client de prova, sense el seu .git,
// dins d'un repositori nou; els generats ja hi són (el sync del client de l'arrel).
describe('subur check en un membre d\'un workspace', { timeout: 120_000 }, () => {
  const top = mkdtempSync(path.join(PKG, 'tests/fixtures/.tmp-app-member-'))
  const member = path.join(top, 'client')
  const gitTop = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@subur.dev', ...args], { cwd: top, encoding: 'utf8', env })
  const pkgPath = path.join(member, 'package.json')
  const withScript = (name: string, value: string) => { const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); pkg.scripts[name] = value; writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`) }
  beforeAll(() => {
    cpSync(app, member, { filter: (src) => path.basename(src) !== '.git', recursive: true })
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: top, env })
    gitTop('add', '-A')
    gitTop('commit', '-q', '-m', 'workspace de prova')
  }, 120_000)
  afterAll(() => rmSync(top, { force: true, recursive: true }))
  beforeEach(() => {
    const r = subur(['check'], member)
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/^check: membre d'un workspace: 4 fitxers de repositori no comprovats/m)
    expect(r.stdout).toMatch(/^check: ok \(10 comprovacions\)$/m)
  }, 120_000)

  it('preseed amb una guarda davant (com la demo) passa', () => {
    withScript('preseed', 'node scripts/assert-db.mjs && subur sync')
    try {
      const r = subur(['check'], member)
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toMatch(/^check: ok \(10 comprovacions\)$/m)
    } finally {
      gitTop('checkout', '--', 'client/package.json')
    }
  })

  it('el prefix no és una porta del darrere: «exit 0; true && …» a preseed, «echo # && …» a seed', () => {
    const seed = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts.seed as string
    withScript('preseed', 'exit 0; true && subur sync')
    withScript('seed', `echo # && ${seed}`)
    try {
      const r = subur(['check'], member)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: scripts\.preseed és «exit 0; true && subur sync», la plantilla diu «subur sync»$/m)
      expect(r.stderr).toMatch(/^check: package\.json: scripts\.seed és «echo # && /m)
    } finally {
      gitTop('checkout', '--', 'client/package.json')
    }
  })

  it('un .pnpmfile.cjs a l\'arrel del repositori (pnpm el llegeix de l\'arrel del workspace) i un al membre', () => {
    writeFileSync(path.join(top, '.pnpmfile.cjs'), 'module.exports = { hooks: {} }\n')
    writeFileSync(path.join(member, '.pnpmfile.mjs'), 'export const hooks = {}\n')
    try {
      const r = subur(['check'], member)
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/^check: package\.json: \.\.\/\.pnpmfile\.cjs més amunt del client \(pnpm el llegeix a l'arrel del workspace\): /m)
      expect(r.stderr).toMatch(/^check: package\.json: \.pnpmfile\.mjs a l'arrel del client: /m)
    } finally {
      rmSync(path.join(top, '.pnpmfile.cjs'))
      rmSync(path.join(member, '.pnpmfile.mjs'))
    }
  })
})
