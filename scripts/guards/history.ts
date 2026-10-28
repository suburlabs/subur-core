// core/scripts/guards/history.ts — la guarda de l'historial del repositori públic (spec §2.3.2; pla E2, R10): autors, committers, missatges i diffs
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { type Finding, scanForClientData } from './clientData.js'

/** Autors i committers: Subur, el noreply de GitHub (persones i [bot]), el committer de les fusions de GitHub, dominis reservats. */
const ALLOWED_IDENTITY = /^(?:[^@\s]+@subur\.dev|\d+\+[A-Za-z0-9-]+(?:\[bot\])?@users\.noreply\.github\.com|noreply@github\.com|[a-z0-9._+-]+@(?:example\.(?:com|net|org)|example|test|invalid))$/i
/** Als missatges, a més de les regles per context: un token sencer en hex (spec §2.3.2) i l'atribució del model (es conserva). */
const HEX32 = /\b[0-9a-f]{32}\b/
const TRAILER = /^Co-Authored-By: .* <noreply@anthropic\.com>$/gim
const GIT = ['-c', 'color.ui=never', '--no-pager']
const git = (dir: string, args: string[]) => execFileSync('git', [...GIT, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 30 })
/** Una troballa per commit i regla: mai la línia (podria ser un token). Un clon superficial és una troballa: amb `--all` només veuria un commit. */
export function scanHistory(dir: string): Finding[] {
  const findings: Finding[] = []
  const add = (hash: string, rule: string) => findings.push({ line: 0, path: hash, rule })
  if (git(dir, ['rev-parse', '--is-shallow-repository']).trim() === 'true') return [{ line: 0, path: '(repositori)', rule: 'superficial' }]
  for (const record of git(dir, ['log', '--all', '--format=%H%x1f%ae%x1f%ce%x1f%s%x1f%b%x1e']).split('\x1e')) {
    const [hash, author, committer, subject, body] = record.trim().split('\x1f')
    if (!hash) continue
    if (!ALLOWED_IDENTITY.test(author)) add(hash, 'autor')
    if (!ALLOWED_IDENTITY.test(committer)) add(hash, 'committer')
    const message = `${subject}\n${body ?? ''}`.replace(TRAILER, '')
    if (HEX32.test(message)) add(hash, 'token')
    for (const rule of new Set(scanForClientData([{ path: `${hash} (missatge)`, text: message }]).map((f) => f.rule))) add(hash, `missatge:${rule}`)
    // El diff sencer del commit en una sola crida, sense el lock (correus de tercers als `deprecated:`): un recorregut per fitxer amb
    // `--name-only` deixa sense escanejar els noms que git cita (no ASCII, cometes, tabuladors) (ronda 2, M9/T13). Els binaris no
    // aporten text al diff.
    // Sense --literal-pathspecs: faria literal el ':(exclude,glob)' i el lock (correus de tercers als deprecated:) s'escanejaria
    const patch = git(dir, ['-c', 'core.quotePath=false', 'show', '--format=', '-p', hash, '--', '.', ':(exclude,glob)**/pnpm-lock.yaml'])
    for (const rule of new Set(scanForClientData([{ path: `${hash} (diff)`, text: patch }]).map((f) => f.rule))) add(hash, `diff:${rule}`)
  }
  return findings
}

if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const dir = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const findings = scanHistory(dir)
  for (const f of [...new Set(findings.map((f) => `${f.path.slice(0, 12)}: ${f.rule}`))]) console.error(f)
  if (findings.length) { console.error(`historial: ${findings.length} troballes`); process.exit(1) }
  console.log('historial: net')
}
