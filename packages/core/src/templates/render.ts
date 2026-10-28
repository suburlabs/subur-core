// core/packages/core/src/templates/render.ts — lectura i renderització de `templates/` (pla E2, R2)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type TemplateVars = { coreVersion: string; domain: string; locale: 'ca' | 'es'; name: string; slug: string }
export const TEMPLATE_KEYS: readonly (keyof TemplateVars)[] = ['coreVersion', 'domain', 'locale', 'name', 'slug']
/** Només aquesta forma és una variable: `${{ vars.X }}` d'un workflow no ho és (té espais i un punt). */
const VAR = /\{\{([a-zA-Z]+)\}\}/g

/** `{{clau}}` → valor. Una clau que no és de `TemplateVars` és un error: una plantilla mal escrita no surt en silenci. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(VAR, (_, key: string) => {
    if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) throw new Error(`plantilla: variable desconeguda {{${key}}}`)
    return vars[key as keyof TemplateVars]
  })
}
/** `templates/client/_gitignore` → `.gitignore`: un `_` inicial a qualsevol segment és un `.` (npm i pnpm no empaqueten `.gitignore` ni `.npmrc`; sonda S-r11). */
export const clientPathOf = (templatePath: string): string => templatePath.split('/').map((s) => (s.startsWith('_') ? `.${s.slice(1)}` : s)).join('/')
export const templatePathOf = (clientPath: string): string => clientPath.split('/').map((s) => (s.startsWith('.') ? `_${s.slice(1)}` : s)).join('/')

/**
 * `templates/` del paquet: des de `dist/templates/render.js` (i des de `src/` a les proves), dos nivells amunt. Amb `path`, no amb
 * `new URL(…, import.meta.url)`: sota el vitest jsdom del paquet, vite reescriu `import.meta.url` a `http://localhost:3000/…` i
 * `fileURLToPath` llança «The URL must be of scheme file» (el mateix parany que `src/config/index.ts` ja documenta). La causa és el
 * `URL` global de jsdom (`new URL('../x', import.meta.url)` hi resol a `http://localhost/`), no `import.meta.url`, que vite conserva.
 */
export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates')
const walk = (dir: string, base = dir): string[] =>
  readdirSync(dir).filter((e) => e !== '.DS_Store').sort().flatMap((e) => (statSync(path.join(dir, e)).isDirectory() ? walk(path.join(dir, e), base) : [path.relative(base, path.join(dir, e))]))
export type Template = { clientPath: string; text: string }
function read(kind: 'client' | 'generated'): Template[] {
  const dir = path.join(TEMPLATES_DIR, kind)
  return walk(dir).map((rel) => ({ clientPath: clientPathOf(rel), text: readFileSync(path.join(dir, rel), 'utf8') })).sort((a, b) => (a.clientPath < b.clientPath ? -1 : 1))
}
/** Les plantilles del client, sense renderitzar (R2): `EXACT_FILES` ∪ `COPIED_FILES`. */
export const readClientTemplates = (): Template[] => read('client')
/** Els fitxers que `subur sync` escriu, tal qual: `GENERATED_FILES`, en ordre lexicogràfic del camí del client. */
export const readGenerated = (): Template[] => read('generated')
