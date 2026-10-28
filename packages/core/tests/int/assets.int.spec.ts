import { existsSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { createSuburAssetsRoute, suburAssetsDir } from '../../src/app/assets.js'
import { allLayoutBlocks } from '../../src/blocks/registry.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'subur-assets-')))
const root = path.join(base, 'assets')
mkdirSync(path.join(root, 'blocks'), { recursive: true })
mkdirSync(path.join(root, 'icons'))
mkdirSync(path.join(root, 'other'))
writeFileSync(path.join(root, 'blocks', 'note.webp'), Buffer.from('RIFFxxxxWEBP'))
writeFileSync(path.join(root, 'icons', 'mark.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
writeFileSync(path.join(root, 'other', 'note.webp'), Buffer.from('RIFFxxxxWEBP'))   // directori no permès, fitxer real
writeFileSync(path.join(base, 'secret.webp'), Buffer.from('RIFFxxxxWEBP'))          // fora de root, fitxer real
writeFileSync(path.join(root, 'blocks', 'nested'), '')                                // sense extensió
const call = (parts: string[]) => createSuburAssetsRoute({ root }).GET(new Request('http://x/'), { params: Promise.resolve({ path: parts }) })

describe('/_subur/* (spec §3.4)', () => {
  it('serveix una miniatura amb el tipus i la capçalera immutable', async () => {
    const res = await call(['blocks', 'note.webp'])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })
  it('serveix una icona svg amb el seu tipus', async () => {
    const res = await call(['icons', 'mark.svg'])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
  })
  it('404 a fitxers REALS fora de blocks/ i icons/ (travessa, directori aliè, ruta absoluta, separador codificat)', async () => {
    // Cada objectiu existeix de debò: sense la guarda SAFE la ruta els serviria amb 200.
    expect(existsSync(path.join(base, 'secret.webp'))).toBe(true)
    expect((await call(['blocks', '..', '..', 'secret.webp'])).status).toBe(404)
    expect((await call(['..', 'secret.webp'])).status).toBe(404)
    expect((await call(['blocks', '..', 'other', 'note.webp'])).status).toBe(404)
    expect((await call(['other', 'note.webp'])).status).toBe(404)
    expect((await call([path.join(base, 'secret.webp')])).status).toBe(404)
    expect((await call(['blocks', '..%2F..%2Fsecret.webp'])).status).toBe(404)
    expect((await call(['blocks', 'nested'])).status).toBe(404)
    expect((await call(['blocks', 'missing.webp'])).status).toBe(404)
  })
  it('la resolució per defecte (sense root) troba dist/assets del paquet instal·lat i les icones del panell', () => {
    expect(suburAssetsDir(PKG)).toBe(path.join(PKG, 'dist/assets'))
    expect(existsSync(path.join(suburAssetsDir(PKG), 'icons/web-app-manifest-192x192.png'))).toBe(true)
  })
  it('troba dist/assets amb el paquet com a symlink (workspace) i com a directori real (standalone traçat)', () => {
    const app = realpathSync(mkdtempSync(path.join(tmpdir(), 'subur-app-')))
    mkdirSync(path.join(app, 'node_modules/@suburlabs'), { recursive: true })
    writeFileSync(path.join(app, 'package.json'), '{}')
    symlinkSync(PKG, path.join(app, 'node_modules/@suburlabs/core'))
    expect(suburAssetsDir(app)).toBe(path.join(PKG, 'dist/assets'))

    const std = realpathSync(mkdtempSync(path.join(tmpdir(), 'subur-std-')))
    const pkgDir = path.join(std, 'node_modules/@suburlabs/core')
    mkdirSync(path.join(pkgDir, 'dist/assets'), { recursive: true })
    writeFileSync(path.join(pkgDir, 'package.json'), '{"name":"@suburlabs/core"}')
    writeFileSync(path.join(std, 'package.json'), '{}')
    expect(suburAssetsDir(std)).toBe(path.join(pkgDir, 'dist/assets'))
  })
  it('cada bloc apunta a /_subur/blocks/<slug>.webp', () => {
    for (const block of allLayoutBlocks) expect(block.imageURL).toBe(`/_subur/blocks/${block.slug}.webp`)
  })
})
