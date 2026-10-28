import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_EXTENSIONS = /\.(css|js|scss|ts|tsx)$/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const sourceFiles = walk('src').filter((file) => SOURCE_EXTENSIONS.test(file))

/**
 * Al paquet no hi ha cap carpeta de client: `src/site` és del nucli, i la frontera es mira a tot `src/`. El patró va
 * escrit amb escapes perquè la guarda «cap dada de client» no trobi el literal en aquesta mateixa prova.
 */
const CLIENT = /\x73itges|h\x6fusekeeping/i

describe('template boundary', () => {
  it('keeps client-specific strings out of the package src', () => {
    const offenders = sourceFiles.filter((file) => CLIENT.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})

describe('Subur branding', () => {
  // Al paquet, l'únic fitxer generat de src/ són els tipus (`src/types/subur-types.ts`); l'importMap és de cada app.
  const generated = new Set([path.join('src', 'types', 'subur-types.ts')])
  const WORD = /(?<![A-Za-z@/.-])Payload(?![A-Za-z])/

  it('never names the CMS engine in source text or comments', () => {
    const offenders = sourceFiles
      .filter((file) => !generated.has(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((text, index) => ({ file, line: index + 1, text: text.trim() }))
          .filter(({ text }) => WORD.test(text)),
      )
    expect(offenders).toEqual([])
  })

  it('presents the project as Subur in package.json and README', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      description: string
      name: string
    }
    expect(`${pkg.name} ${pkg.description}`).not.toMatch(/payload/i)
    expect(readFileSync('README.md', 'utf8')).not.toMatch(WORD)
  })
})
