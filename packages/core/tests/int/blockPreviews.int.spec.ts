// core/packages/core/tests/int/blockPreviews.int.spec.ts
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { allLayoutBlocks } from '../../src/blocks/registry.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT_PREVIEWS = path.resolve(PKG, '../../../public/site/blocks')   // les del client d'aquest repo, fins a E2
const file = (slug: string) => path.join(PKG, 'assets/blocks', `${slug}.webp`)
const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex')

describe('miniatures dels blocs (spec §3.4)', () => {
  it.each(allLayoutBlocks.map((b) => b.slug))('%s.webp existeix al paquet', (slug) => {
    expect(existsSync(file(slug))).toBe(true)
  })
  it('12 captures diferents entre elles, amb mida de miniatura (cap 404, cap bàner repetit)', async () => {
    expect(new Set(allLayoutBlocks.map((b) => sha(file(b.slug)))).size).toBe(12)
    for (const { slug } of allLayoutBlocks) {
      const { height, width } = await sharp(file(slug)).metadata()
      expect(width, slug).toBeGreaterThanOrEqual(480)
      expect(height, slug).toBeGreaterThanOrEqual(160)
    }
  })
  it.skipIf(!existsSync(ROOT_PREVIEWS))('cap és la del client d\'aquest repo', () => {
    for (const { slug } of allLayoutBlocks) {
      const theirs = path.join(ROOT_PREVIEWS, `${slug}.webp`)
      if (existsSync(theirs)) expect(sha(file(slug)), slug).not.toBe(sha(theirs))
    }
  })
})
