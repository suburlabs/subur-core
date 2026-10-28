// core/scripts/guards/clientData.ts — cap patró conté el literal que busca (la guarda s'escaneja a si mateixa)
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type Finding = { line: number; path: string; rule: string }
const RULES: Array<[string, RegExp]> = [
  ['client', /\x73itges|h\x6fusekeeping/i],
  ['ip', /\b9\x31\.98\.\d{1,3}\.\d{1,3}\b/],
  ['servidor', /\/srv\/s\x75bur\b/],
  ['token', /\bhb\x54oken\b|\/(?:hb|state)\/[0-9a-f]{32}\b|BACKUP_HEARTBEAT_\x55RL=\S/],
  // La marca de Subur (§0.5): el catàleg, el logo (identificador i dibuix ASCII) i les tres tipografies (D37).
  ['marca', /@suburlabs\/c\x61talog|\bSubur\x4cogo\b|\{<-{3}>\}|<={3}>|Plus[ _]J\x61karta[ _]Sans|Instrument[ _]S\x65rif|JetBr\x61ins[ _]Mono/],
]
// Qualsevol cometa i també la clau entre cometes (un objecte JSON o una clau citada): `defaultLocale: "es"`, `"defaultLocale": 'es'`.
const LOCALE = /\b(?:defaultLocale|fallbackLocale|fallbackLanguage)['"]?\s*[:=]\s*['"`](?:ca|es|en)['"`]/
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
/** Correus que no són de ningú: els de Subur i els dominis reservats (RFC 2606/6761; D44, D54). */
const ALLOWED_EMAILS = /^(?:[^@\s]+@subur\.dev|[a-z0-9._+-]+@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid))$/i
/**
 * El marcador del text d'ajuda del camp d'enllaç del panell (src/fields/link.ts; el motor el copia als tipus generats, que
 * han de continuar idèntics als de l'arrel, Task 7): és un exemple d'interfície en castellà, no l'adreça de ningú (D44).
 * Exacte: cap altra adreça d'aquest domini no passa.
 */
const PLACEHOLDER_EMAILS = /^hola@ej\x65mplo\.com$/i
/**
 * La línia de copyright de la LICENSE (ruling P32): l'adreça del titular del motor, i només aquesta. Una altra adreça
 * del mateix domini, o d'un domini que hi comenci (`…-client.es`), salta.
 */
const LICENSE_EMAILS = /^inf\x6f@payl\x6fadcms\.com$/i
/**
 * Excepcions exactes (fitxer → regles). Una entrada que ja no troba res és un error (applyAllowlist). Avui és buida: una
 * excepció que viatja amb el text (com el marcador del text d'ajuda, que també surt compilat a dist/) va a la regla, no
 * aquí, perquè una entrada per fitxer quedaria òrfena cada cop que la guarda corre abans del build.
 */
export const ALLOWED: Record<string, string[]> = {}
const SKIP = /\.(webp|png|jpg|jpeg|mp4|ico|woff2?)$|pnpm-lock\.yaml$/

export function scanForClientData(files: Array<{ path: string; text: string }>): Finding[] {
  return files.flatMap(({ path: file, text }) => {
    const localeApplies = file.startsWith('packages/core/src/') && file !== 'packages/core/src/i18n/catalog.ts'
    return text.split('\n').flatMap((line, index) => [
      ...RULES.filter(([, re]) => re.test(line)).map(([rule]) => ({ line: index + 1, path: file, rule })),
      ...(localeApplies && LOCALE.test(line) ? [{ line: index + 1, path: file, rule: 'locale' }] : []),
      ...[...line.matchAll(EMAIL)].filter((m) => ![ALLOWED_EMAILS, PLACEHOLDER_EMAILS, LICENSE_EMAILS].some((re) => re.test(m[0]))).map(() => ({ line: index + 1, path: file, rule: 'correu' })),
    ])
  })
}

/**
 * La meitat `npm pack` només val si el tarball és el real: cada destí `default`/`import` del mapa `exports` hi ha de ser.
 * Sense el build, `npm pack --dry-run` només llista bin/, backup/ i la LICENSE, i la guarda passaria sobre un paquet
 * gairebé buit.
 */
export function missingPackTargets(exportsMap: Record<string, string | Record<string, string>>, packed: string[]): string[] {
  const targets = Object.values(exportsMap).flatMap((t) => (typeof t === 'string' ? [t] : [t.import, t.default].filter((v): v is string => Boolean(v))))
  const have = new Set(packed)
  return [...new Set(targets.map((t) => t.replace(/^\.\//, '')))].filter((t) => !have.has(t))
}

export function applyAllowlist(findings: Finding[], allowed: Record<string, string[]>): { kept: Finding[]; stale: string[] } {
  const kept = findings.filter((f) => !allowed[f.path]?.includes(f.rule))
  const stale = Object.entries(allowed).flatMap(([file, rules]) => rules.filter((rule) => !findings.some((f) => f.path === file && f.rule === rule)).map((rule) => `${file}: ${rule}`))
  return { kept, stale }
}

type PackTargets = Record<string, string | Record<string, string>>
/**
 * Els paquets que es publiquen i, de cadascun, els destins que el tarball ha de portar: els del nucli, el seu mapa `exports`;
 * els de la CLI, el seu `bin`, `dist/cli.js` i la bastida (sense build, `dist/` no hi seria).
 */
const PACKAGES: Array<{ dir: string; targets: (pkg: { bin?: Record<string, string>; exports?: PackTargets }) => PackTargets }> = [
  { dir: 'packages/core', targets: (pkg) => pkg.exports ?? {} },
  { dir: 'packages/create-subur-app', targets: (pkg) => ({ ...pkg.bin, cli: './dist/cli.js', scaffold: './scaffold/src/site/site.config.ts' }) },
]

// Amb realpathSync: sota /var → /private/var (o qualsevol enllaç simbòlic al camí) la comparació literal falla, el bloc no corre i
// la guarda surt 0 sense haver escanejat res.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  // També els fitxers nous sense commit, no els ignorats (D51; sonda S11): el verd abans del commit vol dir alguna cosa.
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], { cwd: CORE, encoding: 'utf8' }).split('\0').filter((f) => f && !SKIP.test(f))
  const packed: string[] = []
  for (const { dir, targets } of PACKAGES) {
    const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: path.join(CORE, dir), encoding: 'utf8' })) as Array<{ files: Array<{ path: string }> }>
    const pkg = JSON.parse(readFileSync(path.join(CORE, dir, 'package.json'), 'utf8')) as { bin?: Record<string, string>; exports?: PackTargets }
    const missing = missingPackTargets(targets(pkg), pack[0].files.map((f) => f.path))
    if (missing.length) {
      for (const m of missing) console.error(`falta al paquet npm de ${dir}: ${m}`)
      console.error('el paquet no està construït: pnpm -C core build')
      process.exit(1)
    }
    packed.push(...pack[0].files.map((f) => `${dir}/${f.path}`).filter((f) => !SKIP.test(f)))
  }
  const files = [...new Set([...tracked, ...packed])].map((f) => ({ path: f, text: readFileSync(path.join(CORE, f), 'utf8') }))
  const { kept, stale } = applyAllowlist(scanForClientData(files), ALLOWED)
  for (const f of kept) console.log(`${f.path}:${f.line} ${f.rule}`)
  for (const s of stale) console.log(`llista permesa òrfena: ${s}`)
  console.log(`guarda: ${files.length} fitxers (${packed.length} dels paquets npm), ${kept.length} troballes, ${stale.length} òrfenes`)
  process.exit(kept.length || stale.length ? 1 : 0)
}
