import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { contrastRatio, parseCssColorScopes } from '../../../../packages/core/src/utilities/contrast.js'

const scopes = parseCssColorScopes(readFileSync('src/site/theme.css', 'utf8'))

describe('contrast helpers', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('separates the light and dark scopes', () => {
    expect(scopes.root.background).toBe('#f4f3ef')
    expect(scopes.dark.background).toBe('#121a16')
  })
})

const pairs: Array<[string, string, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'card', 4.5],
  ['foreground', 'secondary', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'brand-strong', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'card', 4.5],
  ['destructive', 'background', 4.5],
  ['destructive', 'card', 4.5],
  ['shutter-foreground', 'shutter', 4.5],
  ['shutter-foreground', 'shutter-strong', 4.5],
  ['tile-foreground', 'tile', 4.5],
  ['tile-muted-foreground', 'tile', 4.5],
  ['tile-foreground', 'tile-shade', 4.5],
  ['border', 'background', 3],
  ['input', 'card', 3],
  ['ring', 'background', 3],
  ['ring', 'card', 3],

  // Superfícies que es toquen dins d'un mateix bloc.
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['foreground', 'muted', 4.5],
  ['foreground', 'surface-shade', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'surface-shade', 4.5],
  ['primary', 'secondary', 4.5],
  ['primary', 'surface-shade', 4.5],
  ['destructive', 'surface-shade', 4.5],
  ['border', 'card', 3],
  ['border', 'surface-shade', 3],
  ['input', 'background', 3],

  // L'anell de focus, un cop per camp. `primitives.css` redefineix `--ring`
  // a `[data-field='shutter']` i a `.plaque` precisament perquè aquestes tres
  // parelles passin: amb un sol `--ring` global, dues fallaven.
  ['shutter-foreground', 'shutter', 3],
  ['shutter-foreground', 'shutter-strong', 3],
  ['tile-foreground', 'tile', 3],
]

describe.each([
  ['tema clar', 'root' as const],
  ['tema fosc', 'dark' as const],
])('%s', (_name, scope) => {
  const tokens = scopes[scope]

  it.each(pairs)('%s sobre %s arriba a %s:1', (fg, bg, minimum) => {
    expect(tokens[fg], `falta --${fg}`).toBeDefined()
    expect(tokens[bg], `falta --${bg}`).toBeDefined()
    expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(minimum)
  })
})
