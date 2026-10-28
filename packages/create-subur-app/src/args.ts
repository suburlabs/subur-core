// core/packages/create-subur-app/src/args.ts — les opcions (spec §4.1)
import { existsSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

export class CliError extends Error { exitCode = 2 }
export const USAGE = `ús:
  create-subur-app <dir> --slug <id> --domain <domini> --locale ca|es --name "<nom>"
      [--repo suburlabs/<id> --site-url <https://…>] [--business <camí a subur-business>]
      [--umami-website-id <id> --umami-script-url <url>] [--core-tarball <suburlabs-core-x.y.z.tgz>] [--no-build]
  create-subur-app update [<dir>]`
export type CreateOptions = {
  business?: string; coreTarball?: string; coreVersion: string; dir: string; domain: string; locale: 'ca' | 'es'; name: string; noBuild: boolean
  repo?: string; siteUrl?: string; slug: string; umamiScriptUrl?: string; umamiWebsiteId?: string
}
// Les mateixes regles que `collectFacts` del nucli (src/subur/facts.ts): el client no passaria `subur facts` amb altres valors.
const SLUG = /^[a-z0-9_]+$/
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const TARBALL = /^suburlabs-core-(\d+\.\d+\.\d+)\.tgz$/

export function parseCreate(argv: string[], ownVersion: string): CreateOptions {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      business: { type: 'string' }, 'core-tarball': { type: 'string' }, domain: { type: 'string' }, locale: { type: 'string' }, name: { type: 'string' },
      'no-build': { default: false, type: 'boolean' }, repo: { type: 'string' }, 'site-url': { type: 'string' }, slug: { type: 'string' },
      'umami-script-url': { type: 'string' }, 'umami-website-id': { type: 'string' },
    },
  })
  if (positionals.length !== 1) throw new CliError(USAGE)
  const need = (key: 'domain' | 'locale' | 'name' | 'slug') => { const v = values[key]; if (!v) throw new CliError(`falta --${key}\n${USAGE}`); return v }
  const slug = need('slug'); if (!SLUG.test(slug)) throw new CliError(`--slug «${slug}»: minúscules, xifres i _`)
  const domain = need('domain'); if (!DOMAIN.test(domain)) throw new CliError(`--domain «${domain}»: sense https:// ni barres`)
  const locale = need('locale'); if (locale !== 'ca' && locale !== 'es') throw new CliError('--locale ha de ser ca o es')
  const name = need('name'); if (/["\\]/.test(name) || [...name].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) throw new CliError('--name no pot dur cometes dobles, barres invertides ni caràcters de control')
  const repo = values.repo; if (repo !== undefined && !REPO.test(repo)) throw new CliError(`--repo «${repo}»: propietari/nom`)
  const siteUrl = values['site-url']; if (siteUrl !== undefined && !/^https:\/\/[^/\s]+$/.test(siteUrl)) throw new CliError('--site-url ha de ser https://<domini>, sense barra final')
  if (repo && !siteUrl) throw new CliError('--repo necessita --site-url (la variable SITE_URL va abans del primer push)')
  const umamiWebsiteId = values['umami-website-id']; const umamiScriptUrl = values['umami-script-url']
  if ((umamiWebsiteId === undefined) !== (umamiScriptUrl === undefined)) throw new CliError('--umami-website-id i --umami-script-url, tots dos o cap')
  let coreVersion = ownVersion
  const coreTarball = values['core-tarball'] === undefined ? undefined : path.resolve(values['core-tarball'])
  if (coreTarball !== undefined) {
    const m = TARBALL.exec(path.basename(coreTarball)); if (!m) throw new CliError(`--core-tarball ha de ser un suburlabs-core-x.y.z.tgz: ${path.basename(coreTarball)}`)
    if (!existsSync(coreTarball)) throw new CliError(`--core-tarball no existeix: ${coreTarball}`)
    coreVersion = m[1]
  }
  const business = values.business === undefined ? undefined : path.resolve(values.business)
  if (business !== undefined && !existsSync(business)) throw new CliError(`--business no existeix: ${business}`)
  return { business, coreTarball, coreVersion, dir: path.resolve(positionals[0]), domain, locale, name, noBuild: values['no-build'], repo, siteUrl, slug, umamiScriptUrl, umamiWebsiteId }
}
