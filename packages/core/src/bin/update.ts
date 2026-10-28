// core/packages/core/src/bin/update.ts — `subur update`: torna a escriure el contracte amb la versió instal·lada (spec §4.1; pla E2, R8)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CORE_SCRIPTS, EXACT_FILES, REQUIRED_GITIGNORE } from '../templates/files.js'
import { readClientTemplates, renderTemplate, type TemplateVars } from '../templates/render.js'
import { loadSiteConfig } from './loadClient.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
/** Reescrits sencers: les exactes i els tres .env*.example (la versió nova pot dur variables noves: es veu al diff). */
const REWRITTEN: readonly string[] = [...EXACT_FILES, '.env.example', '.env.docker.example', '.env.backup.example']

export async function update(cwd: string): Promise<{ changed: string[] }> {
  const siteConfig = await loadSiteConfig(cwd)
  const version = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version
  const vars: TemplateVars = { coreVersion: version, domain: siteConfig.domain, locale: siteConfig.clientLocale as 'ca' | 'es', name: siteConfig.name, slug: siteConfig.id }
  const changed: string[] = []
  const write = (clientPath: string, text: string) => {
    const file = path.join(cwd, clientPath)
    if (existsSync(file) && readFileSync(file, 'utf8') === text) return
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
    changed.push(clientPath)
  }
  const templates = readClientTemplates()
  for (const { clientPath, text } of templates) if (REWRITTEN.includes(clientPath)) write(clientPath, renderTemplate(text, vars))
  // .gitignore: s'hi afegeixen les línies obligatòries que faltin (el client hi pot tenir les seves).
  const gitignore = path.join(cwd, '.gitignore')
  const current = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
  const have = new Set(current.split('\n').map((l) => l.trim()))
  const missing = REQUIRED_GITIGNORE.filter((l) => !have.has(l))
  if (missing.length > 0) write('.gitignore', `${current.replace(/\n*$/, '\n')}# Afegit per subur update ${version}\n${missing.join('\n')}\n`)
  // package.json: els camps del contracte (R5 (6)); dependències i scripts propis del client, intactes.
  const pkgFile = path.join(cwd, 'package.json')
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as Record<string, unknown> & { engines?: Record<string, string>; scripts?: Record<string, string> }
    const tpl = JSON.parse(renderTemplate(templates.find((t) => t.clientPath === 'package.json')!.text, vars)) as { engines: Record<string, string>; packageManager: string; scripts: Record<string, string>; type: string }
    pkg.packageManager = tpl.packageManager
    pkg.type = tpl.type
    pkg.engines = { ...pkg.engines, node: tpl.engines.node }
    pkg.scripts = { ...pkg.scripts, ...Object.fromEntries(CORE_SCRIPTS.map((s) => [s, tpl.scripts[s]])) }
    write('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
  }
  return { changed }
}

/** El resum per a l'usuari: els fitxers i, si és un repositori git, `git diff --stat` d'aquests fitxers. */
export function summary(cwd: string, changed: string[]): string {
  if (changed.length === 0) return 'subur update: cap canvi (el client ja és el de la versió instal·lada)'
  const stat = spawnSync('git', ['-c', 'color.ui=never', '--literal-pathspecs', '--no-pager', 'diff', '--stat', '--', ...changed], { cwd, encoding: 'utf8' })
  return [`subur update: ${changed.length} fitxers reescrits`, ...changed.map((f) => `  ${f}`), ...(stat.status === 0 && stat.stdout.trim() ? [stat.stdout.trimEnd(), 'Revisa el diff i confirma el commit.'] : [])].join('\n')
}
