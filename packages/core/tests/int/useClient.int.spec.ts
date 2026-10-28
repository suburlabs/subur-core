// §3.1: 'use client' conservat a dist.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const walk = (dir: string): string[] => readdirSync(dir).flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e)) : [path.join(dir, e)]))
const DIRECTIVE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*['"]use client['"]/
const count = (dir: string, ext: RegExp) => walk(path.join(PKG, dir)).filter((f) => ext.test(f) && DIRECTIVE.test(readFileSync(f, 'utf8'))).length

describe('\'use client\' (spec §3.1)', () => {
  it('cada mòdul de client de src el conserva a dist', () => {
    expect(count('dist', /\.js$/)).toBe(count('src', /\.(ts|tsx)$/))
    expect(count('src', /\.(ts|tsx)$/)).toBe(29)
  })
})
