// core/packages/core/tests/int/pack.int.spec.ts — el que npm publicaria (spec §1 criteri 4; C67)
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { allLayoutBlocks } from '../../src/blocks/registry.js'
import { GENERATED_FILES } from '../../src/templates/files.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const files = (JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: PKG, encoding: 'utf8' })) as Array<{ files: Array<{ path: string }> }>)[0].files.map((f) => f.path)
const pkg = JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { exports: Record<string, string | Record<string, string>> }

describe('npm pack --dry-run', () => {
  it('porta cada destí d\'exports, el shim i el binari, backup/VERSION, la declaració del client, les 12 miniatures i les plantilles (client/ i generated/)', () => {
    const targets = Object.values(pkg.exports).flatMap((t) => (typeof t === 'string' ? [t] : Object.values(t))).map((t) => t.replace(/^\.\//, ''))
    for (const want of [...targets, 'bin/subur.js', 'dist/bin/subur.js', 'backup/VERSION', 'dist/subur-site-config.d.ts', 'LICENSE', ...allLayoutBlocks.map((b) => `dist/assets/blocks/${b.slug}.webp`), 'templates/client/package.json', 'templates/client/_gitignore', 'templates/client/_dockerignore', 'templates/client/_npmrc', 'templates/client/_env.example', 'templates/client/_env.docker.example', 'templates/client/_env.backup.example', 'templates/client/_github/workflows/image.yml', ...GENERATED_FILES.map((f) => 'templates/generated/' + f)]) expect(files, want).toContain(want)
  })
  it('no porta fonts, tests ni .d.ts al directori de migracions', () => {
    expect(files.filter((f) => f.startsWith('src/') || f.startsWith('tests/') || /^dist\/migrations\/.*\.d\.ts$/.test(f))).toEqual([])
  })
  it('porta una migració compilada per cada migració de les fonts, i les dues icones del manifest web', () => {
    const sources = readdirSync(path.join(PKG, 'src/migrations')).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    const compiled = files.filter((f) => /^dist\/migrations\/[^/]+\.js$/.test(f) && f !== 'dist/migrations/index.js')
    expect(sources.length).toBeGreaterThan(0)
    expect(compiled).toHaveLength(sources.length)
    for (const size of ['192x192', '512x512']) expect(files).toContain(`dist/assets/icons/web-app-manifest-${size}.png`)
  })
})
