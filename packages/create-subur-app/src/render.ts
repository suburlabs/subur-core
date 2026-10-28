// core/packages/create-subur-app/src/render.ts — la mateixa regla que src/templates/render.ts del nucli (la CLI no en depèn; R2)
export type Vars = { coreVersion: string; domain: string; locale: 'ca' | 'es'; name: string; slug: string }
/** Les mateixes claus que TEMPLATE_KEYS del nucli (parity.int.spec ho afirma llegint render.ts del nucli com a text). */
export const KEYS: readonly (keyof Vars)[] = ['coreVersion', 'domain', 'locale', 'name', 'slug']
const VAR = /\{\{([a-zA-Z]+)\}\}/g
export function render(text: string, vars: Vars): string {
  return text.replace(VAR, (_, key: string) => { if (!(KEYS as readonly string[]).includes(key)) throw new Error(`plantilla: variable desconeguda {{${key}}}`); return vars[key as keyof Vars] })
}
export const clientPathOf = (p: string): string => p.split('/').map((s) => (s.startsWith('_') ? `.${s.slice(1)}` : s)).join('/')
/** Els únics fitxers de la bastida que es renderitzen (ronda 1, C1; el contingut del seed porta `{{nom}}`/`{{email}}` del formulari i NO s'ha de tocar). */
export const RENDERED: readonly string[] = ['src/site/site.config.ts', 'README.md', 'DESIGN.md', 'PRODUCT.md']
