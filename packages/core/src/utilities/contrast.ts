const channel = (value: number) => {
  const srgb = value / 255
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

export function parseCssColorTokens(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((match) => [
      match[1],
      match[2].toLowerCase(),
    ]),
  )
}

export type ColorScopes = {
  dark: Record<string, string>
  root: Record<string, string>
}

const blockFor = (css: string, selector: string): string => {
  const start = css.indexOf(selector)
  if (start === -1) return ''
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return open === -1 || close === -1 ? '' : css.slice(open + 1, close)
}

export function parseCssColorScopes(css: string): ColorScopes {
  const root = parseCssColorTokens(blockFor(css, ':root'))
  return { dark: { ...root, ...parseCssColorTokens(blockFor(css, '.dark')) }, root }
}
