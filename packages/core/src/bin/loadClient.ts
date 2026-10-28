import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { SanitizedConfig } from 'payload'
import { tsImport } from 'tsx/esm/api'

import type { SiteConfig } from '../site/index.js'
import { readSuburContract, SUBUR_DIR } from '../subur/contract.js'
import { collectFacts, type Facts } from '../subur/facts.js'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Carrega un fitxer TS del client amb el seu cwd i el seu tsconfig, com fa el CLI del motor (spec §5.2). */
async function importClient<T>(cwd: string, file: string): Promise<T> {
  return (await tsImport(pathToFileURL(path.join(cwd, file)).href, { parentURL: pathToFileURL(`${cwd}/`).href, tsconfig: path.join(cwd, 'tsconfig.json') })) as T
}
export async function loadSiteConfig(cwd: string): Promise<SiteConfig> {
  return (await importClient<{ siteConfig: SiteConfig }>(cwd, 'src/site/site.config.ts')).siteConfig
}
export async function loadClientConfig(cwd: string): Promise<SanitizedConfig> {
  return await (await importClient<{ default: Promise<SanitizedConfig> | SanitizedConfig }>(cwd, 'src/payload.config.ts')).default
}

/** Els fets del client del cwd, els de `subur facts --json` (també els de `subur gate`); `warn` rep l'avís quan no hi ha `.subur/`. */
export async function loadFacts(cwd: string, warn: (message: string) => void): Promise<Facts> {
  const siteConfig = await loadSiteConfig(cwd)
  const contract = existsSync(path.join(cwd, SUBUR_DIR)) ? readSuburContract(cwd, siteConfig.id) : null
  if (!contract) warn(`sense ${SUBUR_DIR}/: activeLocales només amb l'idioma per defecte`)
  const versionFile = path.join(PKG, 'backup/VERSION')
  return collectFacts({
    backupVersion: existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : null,
    contract,
    packageVersion: (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version,
    siteConfig,
  })
}
