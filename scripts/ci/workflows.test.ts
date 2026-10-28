// core/scripts/ci/workflows.test.ts — els workflows del repositori públic i la plantilla image.yml del client, sobre el text
// (cap dependència YAML: R16, R20). Les formes que el pla fixa (R16, R17, R21) i el contracte entre la plantilla i client-image.yml.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { renderTemplate } from '../../packages/core/src/templates/render.js'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WORKFLOWS = path.join(CORE, '.github/workflows')
const ROOT_CORE_YML = path.resolve(CORE, '../.github/workflows/core.yml')
const read = (file: string) => readFileSync(path.join(WORKFLOWS, file), 'utf8')
const template = renderTemplate(readFileSync(path.join(CORE, 'packages/core/templates/client/_github/workflows/image.yml'), 'utf8'), { coreVersion: '0.1.0', domain: 'demo.example', locale: 'ca', name: 'Demo', slug: 'demo' })
const clientImage = read('client-image.yml')
const check = read('check.yml')
const release = read('release.yml')
const backup = read('backup.yml')

const indent = (line: string) => line.length - line.trimStart().length
/** Les línies que pengen d'una clau (més sagnades que ella), fins a la primera que no ho és; les buides hi entren. */
function childLines(lines: string[], at: number): string[] {
  const out: string[] = []
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && indent(line) <= indent(lines[at])) break
    out.push(line)
  }
  return out
}
/** El bloc de cada job (`  <nom>:` sota `jobs:`), pel nom. */
function jobs(text: string): Map<string, string> {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l))
  const blocks = new Map<string, string>()
  if (start < 0) return blocks
  const body = childLines(lines, start)
  body.forEach((line, i) => {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)
    if (m) blocks.set(m[1], [line, ...childLines(body, i)].join('\n'))
  })
  return blocks
}
/** Les claus directes d'un mapa en bloc (la primera indentació de sota la clau). */
function keysUnder(text: string, key: RegExp): string[] {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => key.test(l))
  if (at < 0) return []
  const children = childLines(lines, at).filter((l) => l.trim() && !l.trim().startsWith('#'))
  const level = Math.min(...children.map(indent))
  return children.filter((l) => indent(l) === level).map((l) => l.trim().split(':')[0])
}
/** `permissions` d'un job com a mapa clau → valor, en flux (`{ a: b, c: d }`) o en bloc (`a: b` per línia). */
function permissions(block: string): Record<string, string> | undefined {
  const lines = block.split('\n')
  const at = lines.findIndex((l) => /^\s*permissions:/.test(l))
  if (at < 0) return undefined
  const rest = lines[at].replace(/^\s*permissions:\s*/, '').replace(/\s+#.*$/, '').trim()
  const pairs = rest.startsWith('{') ? rest.replace(/^\{|\}$/g, '').split(',') : childLines(lines, at).filter((l) => l.trim() && !l.trim().startsWith('#'))
  return Object.fromEntries(pairs.map((p) => p.split(':').map((s) => s.trim())).filter(([k]) => k).map(([k, v]) => [k, v]))
}
/** El bloc `env:` del nivell superior (fins a la següent clau sense sagnat). */
const topEnv = (text: string) => {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => /^env:\s*$/.test(l))
  return at < 0 ? '' : [lines[at], ...childLines(lines, at)].join('\n').trimEnd()
}

describe('el mini-analitzador de la prova', () => {
  it('llegeix permissions en flux i en bloc, i els jobs pel nom', () => {
    expect(permissions('  a:\n    permissions: { contents: read, packages: write }\n')).toEqual({ contents: 'read', packages: 'write' })
    expect(permissions('  a:\n    permissions:\n      contents: read\n      packages: write\n    steps: []\n')).toEqual({ contents: 'read', packages: 'write' })
    expect(permissions('  a:\n    steps: []\n')).toBeUndefined()
    expect([...jobs('jobs:\n  a:\n    x: 1\n\n  b:\n    y: 2\n').keys()]).toEqual(['a', 'b'])
  })
})

describe('client-image.yml: el workflow reutilitzable dels clients', () => {
  it('workflow_call amb site_url obligatori i les dues d\'Umami opcionals', () => {
    expect(clientImage).toMatch(/^on:\n {2}workflow_call:\n {4}inputs:\n/m)
    const inputs = keysUnder(clientImage, /^ {4}inputs:\s*$/)
    expect(inputs.sort()).toEqual(['site_url', 'umami_script_url', 'umami_website_id'])
    const lines = clientImage.split('\n')
    const block = (name: string) => childLines(lines, lines.findIndex((l) => l === `      ${name}:`)).join('\n')
    expect(block('site_url')).toMatch(/required: true/)
    expect(block('umami_website_id')).toMatch(/required: false/)
    expect(block('umami_script_url')).toMatch(/required: false/)
  })
  it('els inputs són exactament el `with:` de la plantilla image.yml del client', () => {
    expect(keysUnder(template, /^ {4}with:\s*$/).sort()).toEqual(keysUnder(clientImage, /^ {4}inputs:\s*$/).sort())
    expect(template).toContain('uses: suburlabs/subur-core/.github/workflows/client-image.yml@v0.1.0')
  })
  it('sync, check i typecheck en aquest ordre; migracions, porta, imatges i promoció per digest', () => {
    const sync = clientImage.indexOf('pnpm exec subur sync')
    const subCheck = clientImage.indexOf('pnpm exec subur check')
    const typecheck = clientImage.indexOf('pnpm typecheck')
    expect(sync).toBeGreaterThan(-1)
    expect(subCheck).toBeGreaterThan(sync)
    expect(typecheck).toBeGreaterThan(subCheck)
    for (const s of ['pnpm exec subur migrate', 'pnpm exec subur gate', 'ghcr.io/${{ github.repository }}', 'target: builder', 'imagetools create -t "${repo}:latest"']) expect(clientImage).toContain(s)
    // Cap etiqueta v* ni concurrency: les posa qui crida
    expect(clientImage).not.toMatch(/^concurrency:/m)
  })
  it('els permisos de cada job caben en els que la plantilla dona (comparats com a mapes)', () => {
    const granted = permissions(jobs(template).get('image') ?? '')
    expect(granted).toEqual({ contents: 'read', packages: 'write' })
    const all = jobs(clientImage)
    expect([...all.keys()]).toEqual(['check', 'image'])
    for (const [name, block] of all) {
      const asked = permissions(block)
      expect(asked, `${name}: sense permissions`).toBeDefined()
      for (const [k, v] of Object.entries(asked ?? {})) expect(granted?.[k], `${name}: ${k}: ${v}`).toBe(v)
    }
  })
  it('el Postgres de les proves: el mateix servei als dos jobs; el job check, només amb lectura', () => {
    const all = jobs(clientImage)
    const services = (name: string) => {
      const lines = (all.get(name) ?? '').split('\n')
      const at = lines.findIndex((l) => /^ {4}services:\s*$/.test(l))
      return at < 0 ? '' : [lines[at], ...childLines(lines, at)].join('\n').trimEnd()
    }
    expect(services('image')).toContain('image: postgres:17-alpine')
    expect(services('image')).toContain("ports: ['5432:5432']")
    expect(services('image')).toContain('--health-cmd "pg_isready -U subur"')
    expect(services('check')).toBe(services('image'))
    expect(permissions(all.get('check') ?? '')).toEqual({ contents: 'read' })
    expect(clientImage).toMatch(/^ {2}DATABASE_URL: postgres:\/\/subur:subur@127\.0\.0\.1:5432\/subur$/m)
  })
  it('la plantilla image.yml porta concurrency (client-image.yml no en té)', () => {
    expect(template).toMatch(/^concurrency:\n {2}group: /m)
  })
})

describe('check.yml: el CI del repositori públic', () => {
  const all = jobs(check)
  it('els jobs check, e2e i acceptance', () => expect([...all.keys()]).toEqual(['check', 'e2e', 'acceptance']))
  it('el job check: la història sencera i les dues guardes, cadascuna amb la seva línia de verd', () => {
    const job = all.get('check') ?? ''
    expect(job).toContain('fetch-depth: 0')
    expect(job).toContain('pnpm guards:history')
    expect(job).toContain("grep -q 'historial: net'")
    expect(job).toContain('pnpm guards:templates')
    expect(job).toContain("grep -q '^plantilles: '")
    expect(job).toContain('timeout-minutes: 40')
  })
  it('sense res de l\'arrel: ni working-directory: core, ni les còpies, ni les guardes de l\'arrel', () => {
    expect(check).not.toContain('working-directory')
    expect(check).not.toContain('copy.mjs')
    expect(check).not.toContain('core/')
    expect(check).toContain('cache-dependency-path: pnpm-lock.yaml')
    expect(check).toContain('path: examples/demo/playwright-report')
    expect(check).toMatch(/group: check-\$\{\{ github\.ref \}\}-/)
  })
  it('l\'acceptació', () => expect(all.get('acceptance')).toContain('pnpm acceptance'))
  it('la regex de la variant de @payloadcms/ui', () => {
    expect(all.get('e2e')).toContain("grep -rhoE '@payloadcms\\+ui@[0-9][A-Za-z0-9.+@_-]*' examples/demo/.next/server")
  })
  it.skipIf(!existsSync(ROOT_CORE_YML))('el mateix env: que el core.yml de l\'arrel, i la mateixa regex de @payloadcms/ui', () => {
    const coreYml = readFileSync(ROOT_CORE_YML, 'utf8')
    expect(topEnv(check)).not.toBe('')
    expect(topEnv(check)).toBe(topEnv(coreYml))
    expect(coreYml).toContain("'@payloadcms\\+ui@[0-9][A-Za-z0-9.+@_-]*'")
  })
})

describe('release.yml: changesets, npm amb procedència i l\'etiqueta v<x.y.z>', () => {
  it('les peces dictades', () => {
    for (const s of [
      'id-token: write',
      'id: changesets',
      'uses: changesets/action@v2.1.2',
      'version-script: pnpm changeset version',
      'publish-script: pnpm release',
      "commit-message: 'chore: version packages'",
      "pr-title: 'chore: version packages'",
      'git ls-remote --tags origin "refs/tags/v${v}"',
      "NPM_CONFIG_PROVENANCE: 'true'",
      "if: steps.changesets.outputs.has-changesets == 'false'",
      'git show "$1:packages/core/package.json"',
      'PUBLISHED: ${{ steps.changesets.outputs.published }}',
      '${GITHUB_SHA}^1',
      '::error::',
      'git tag "v${v}" "${GITHUB_SHA}"',
      'git push origin "refs/tags/v${v}"',
      '[ "${v}" != 0.0.0 ]',
      'for i in 1 2 3 4 5 6',
    ]) expect(release, s).toContain(s)
  })
})

describe('backup.yml: la imatge de còpies des de les fonts', () => {
  it('construeix packages/core/backup, cap còpia per digest', () => {
    expect(backup).toContain('context: packages/core/backup')
    expect(backup).toContain('packages/core/backup/VERSION')
    expect(backup).not.toContain('BACKUP_COPY_FROM')
    expect(backup).not.toContain('imagetools create')
  })
  it('el job tag: contents: write i backup-v<VERSION>, després del build i només des de main', () => {
    const tag = jobs(backup).get('tag') ?? ''
    expect(tag).toContain('needs: build')
    expect(permissions(tag)).toEqual({ contents: 'write' })
    expect(tag).toContain('backup-v')
    expect(tag).toContain("github.ref == 'refs/heads/main'")
  })
})

describe('cap run: d\'una línia que YAML llegeixi d\'una altra manera', () => {
  it('en un escalar pla, `: ` és un separador i ` #` un comentari: aquestes ordres van en bloc (`run: |`)', () => {
    for (const file of readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'))) {
      for (const line of read(file).split('\n')) {
        const m = /^\s*(?:-\s*)?run:\s*([^|>'"\s].*)$/.exec(line)
        if (m) expect(m[1], `${file}: ${line.trim()}`).not.toMatch(/: | #/)
      }
    }
  })
})

describe('cada uses: fixat', () => {
  it('a una versió (@vN o @vN.N.N) o a un SHA de 40 hex', () => {
    const files = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'))
    expect(files.sort()).toEqual(['backup.yml', 'check.yml', 'client-image.yml', 'release.yml'])
    const uses = [...files.map(read), template].flatMap((text) => [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)(?:\s+#\s*v\S*)?\s*$/gm)].map((m) => m[1]))
    expect(uses.length).toBeGreaterThan(0)
    // Tota línia `uses:` ha de casar amb la forma de dalt (un comentari que no és `# v…` faria que no hi casés)
    const lines = [...files.map(read), template].flatMap((text) => text.split('\n').filter((l) => /^\s*(?:-\s*)?uses:/.test(l)))
    expect(uses.length).toBe(lines.length)
    for (const ref of uses) expect(ref, ref).toMatch(/@(?:v\d+(?:\.\d+\.\d+)?|[0-9a-f]{40})$/)
  })
})
