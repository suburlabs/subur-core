import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Lector de la projecció `.subur/` (spec §25.3), esquema 1. La genera
 * `subur client project` a subur-business i no s'edita a mà. La llegeixen
 * les eines de l'operador (`pnpm ops`, `pnpm handoff`, `pnpm seo:report`) i el
 * seed de desenvolupament: mai cap codi que corri al servidor, on `.subur/`
 * no hi és (`.dockerignore`). Cap valor per defecte, llevat de `footerCredit`
 * (absent → fals, spec §0.5): tot altre error és explícit.
 */
export type Plan = 'business' | 'starter'
export type ClientStatus = 'actiu' | 'hibernació' | 'baixa'
export type ModuleEntry = { agreement: string; id: string; origin: 'addon' | 'hores' | 'plan' }
export type SuburContract = {
  contract: { current: { effectiveFrom: string; plan: Plan; revision: string }; history: unknown[]; name: string; schema: 1; slug: string; status: ClientStatus }
  modules: { excluded: string[]; included: ModuleEntry[]; limits: { additionalLanguages: number; editorialHoursPerMonth: number; languages: number; pages: number }; schema: 1 }
  operations: { backup: { copies: number; frequency: 'daily' | 'monthly' }; handoffDays: number; responseBusinessDays: number; retentionDays: number; revision: string; schema: 1; seoReport: 'audit' | 'quarterly' }
  /** `contract.current.plan`. */
  plan: Plan
  /** Els ids d'`included`, en l'ordre del fitxer. */
  moduleIds: string[]
  /** `modules.limits.languages`: el màxim d'`activeLocales`. */
  maxLanguages: number
  /** `contract.footerCredit` (clau opcional, spec §0.5): si no hi és, fals, perquè un contracte antic no l'encengui. */
  footerCredit: boolean
}

export class SuburContractError extends Error {}

export const SUBUR_DIR = '.subur'
export const SCHEMA = 1
export const MISSING_HINT = "Falta .subur/: genera'l des de subur-business (subur client project <slug> --repo .)"

type FileName = 'contract' | 'modules' | 'operations'

const fail = (file: FileName, detail: string): never => {
  throw new SuburContractError(`.subur/${file}.json: ${detail}`)
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min: number): v is number => Number.isInteger(v) && (v as number) >= min
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => typeof v === 'string' && (options as readonly string[]).includes(v)
const list = (options: readonly string[]) => (options.length === 2 ? options.join(' o ') : `${options.slice(0, -1).join(', ')} o ${options.at(-1)}`)

function readJson(repoRoot: string, file: FileName): Record<string, unknown> {
  const full = path.join(repoRoot, SUBUR_DIR, `${file}.json`)
  if (!existsSync(full)) throw new SuburContractError(`${MISSING_HINT} (no hi ha .subur/${file}.json)`)
  let doc: unknown
  try {
    doc = JSON.parse(readFileSync(full, 'utf8'))
  } catch {
    return fail(file, 'no és JSON')
  }
  if (!isRecord(doc)) return fail(file, 'no és un objecte')
  if (doc.schema !== SCHEMA) return fail(file, `esquema ${String(doc.schema)} desconegut (aquest repositori coneix l'${SCHEMA})`)
  return doc
}

const PLANS = ['business', 'starter'] as const
const STATUSES = ['actiu', 'hibernació', 'baixa'] as const
const ORIGINS = ['plan', 'addon', 'hores'] as const
const FREQUENCIES = ['daily', 'monthly'] as const
const REPORTS = ['audit', 'quarterly'] as const

function parseContract(doc: Record<string, unknown>, siteId: string): SuburContract['contract'] {
  const f = 'contract'
  if (typeof doc.slug !== 'string' || doc.slug === '') fail(f, 'slug ha de ser un text')
  if (doc.slug !== siteId) throw new SuburContractError(`.subur/ és del client «${String(doc.slug)}», no de «${siteId}»`)
  if (typeof doc.name !== 'string') fail(f, 'name ha de ser un text')
  if (!oneOf(doc.status, STATUSES)) fail(f, `status ha de ser ${list(STATUSES)}`)
  if (!isRecord(doc.current)) fail(f, 'current ha de ser un objecte (regenera .subur/ amb subur-business ≥ 7ffd5a8)')
  const current = doc.current as Record<string, unknown>
  if (!oneOf(current.plan, PLANS)) fail(f, `current.plan ha de ser ${list(PLANS)}`)
  if (typeof current.revision !== 'string' || current.revision === '') fail(f, 'current.revision ha de ser un text')
  if (typeof current.effectiveFrom !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(current.effectiveFrom)) fail(f, 'current.effectiveFrom ha de ser una data AAAA-MM-DD')
  if (!Array.isArray(doc.history)) fail(f, 'history ha de ser una llista')
  return { current: { effectiveFrom: current.effectiveFrom as string, plan: current.plan as Plan, revision: current.revision as string }, history: doc.history as unknown[], name: doc.name as string, schema: SCHEMA, slug: doc.slug as string, status: doc.status as ClientStatus }
}

function parseModules(doc: Record<string, unknown>): SuburContract['modules'] {
  const f = 'modules'
  if (!Array.isArray(doc.included)) fail(f, 'included ha de ser una llista')
  const included = (doc.included as unknown[]).map((entry, i) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') fail(f, `included[${i}].id ha de ser un text`)
    const e = entry as Record<string, unknown>
    if (!oneOf(e.origin, ORIGINS)) fail(f, `included[${i}].origin ha de ser ${list(ORIGINS)}`)
    if (typeof e.agreement !== 'string') fail(f, `included[${i}].agreement ha de ser un text`)
    return { agreement: e.agreement as string, id: e.id as string, origin: e.origin as ModuleEntry['origin'] }
  })
  if (!Array.isArray(doc.excluded) || !(doc.excluded as unknown[]).every((id) => typeof id === 'string')) fail(f, 'excluded ha de ser una llista de textos')
  if (!isRecord(doc.limits)) fail(f, 'limits ha de ser un objecte')
  const limits = doc.limits as Record<string, unknown>
  for (const key of ['pages', 'additionalLanguages', 'editorialHoursPerMonth'] as const) if (!isInt(limits[key], 0)) fail(f, `limits.${key} ha de ser un enter ≥ 0`)
  if (!isInt(limits.languages, 1)) fail(f, 'limits.languages ha de ser un enter ≥ 1')
  return { excluded: doc.excluded as string[], included, limits: { additionalLanguages: limits.additionalLanguages as number, editorialHoursPerMonth: limits.editorialHoursPerMonth as number, languages: limits.languages as number, pages: limits.pages as number }, schema: SCHEMA }
}

function parseOperations(doc: Record<string, unknown>): SuburContract['operations'] {
  const f = 'operations'
  if (typeof doc.revision !== 'string' || doc.revision === '') fail(f, 'revision ha de ser un text')
  if (!isRecord(doc.backup)) fail(f, 'backup ha de ser un objecte')
  const backup = doc.backup as Record<string, unknown>
  if (!oneOf(backup.frequency, FREQUENCIES)) fail(f, `backup.frequency ha de ser ${list(FREQUENCIES)}`)
  if (!isInt(backup.copies, 1)) fail(f, 'backup.copies ha de ser un enter ≥ 1')
  for (const key of ['responseBusinessDays', 'handoffDays', 'retentionDays'] as const) if (!isInt(doc[key], 0)) fail(f, `${key} ha de ser un enter ≥ 0`)
  if (!oneOf(doc.seoReport, REPORTS)) fail(f, `seoReport ha de ser ${list(REPORTS)}`)
  return { backup: { copies: backup.copies as number, frequency: backup.frequency as 'daily' | 'monthly' }, handoffDays: doc.handoffDays as number, responseBusinessDays: doc.responseBusinessDays as number, retentionDays: doc.retentionDays as number, revision: doc.revision as string, schema: SCHEMA, seoReport: doc.seoReport as 'audit' | 'quarterly' }
}

/** L'únic valor per defecte del lector: la clau és opcional a l'esquema 1 (spec §0.5, §0.6), i absent vol dir fals. */
function parseFooterCredit(doc: Record<string, unknown>): boolean {
  if (doc.footerCredit === undefined) return false
  if (typeof doc.footerCredit !== 'boolean') fail('contract', 'footerCredit ha de ser true o false')
  return doc.footerCredit as boolean
}

/** Llegeix i valida `.subur/` de `repoRoot` per al client `siteId` (`siteConfig.id`). Llança `SuburContractError`. */
export function readSuburContract(repoRoot: string, siteId: string): SuburContract {
  const contractDoc = readJson(repoRoot, 'contract')
  const contract = parseContract(contractDoc, siteId)
  const modules = parseModules(readJson(repoRoot, 'modules'))
  const operations = parseOperations(readJson(repoRoot, 'operations'))
  return { contract, footerCredit: parseFooterCredit(contractDoc), maxLanguages: modules.limits.languages, moduleIds: modules.included.map((m) => m.id), modules, operations, plan: contract.current.plan }
}

export const hasModuleIn = (contract: Pick<SuburContract, 'moduleIds'>, id: string): boolean => contract.moduleIds.includes(id)
