import type { SeedBuild } from './types.js'
import { mergeLocalized } from './mergeLocalized.js'
import { seedUiOverrides } from './uiOverrides.js'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * `location.areaServed` és l'única llista localitzada dels globals que se
 * sembren: cada idioma hi té les seves files, però `id` és la clau primària de
 * `site_settings_location_area_served` i és compartida entre idiomes.
 * `mergeLocalized` conserva els `id` del document de l'idioma per defecte — cosa
 * correcta per a les llistes NO localitzades, com `socials` o les columnes del
 * peu, que així s'actualitzen en lloc de duplicar-se —, però escriure aquests
 * mateixos `id` en un altre idioma xoca amb la clau primària (Postgres 23505,
 * que Subur tradueix a «el camp id ha de ser únic»). Els retirem perquè
 * insereixi files noves per a l'idioma que s'està escrivint. Sense això la
 * sembra falla en arribar al primer idioma traduït, tant si porta
 * `areaServed` traduït com si no: les files de l'idioma per defecte hi arriben
 * igualment pel document de l'idioma per defecte.
 */
const withoutAreaServedIds = (location: unknown): unknown => {
  if (!isPlainObject(location) || !Array.isArray(location.areaServed)) return location
  return {
    ...location,
    areaServed: location.areaServed.map((row) => {
      if (!isPlainObject(row)) return row
      const { id: _id, ...rest } = row
      return rest
    }),
  }
}

/**
 * Combina el document de `site-settings` en l'idioma per defecte (`current`,
 * ja sense els camps que gestiona Subur) amb el contingut traduït a un altre
 * idioma (`localized`), per escriure'l a la sembra. La resta de camps es
 * fusiona com sempre (`mergeLocalized`), però `ui` s'escriu sempre sencer i
 * explícit amb `seedUiOverrides`: mai s'hereta del document per defecte
 * (evitaria que el text de l'idioma per defecte s'escolés als altres idiomes) ni queda penjat
 * d'una sembra anterior (la fusió parcial de `updateGlobal` no esborraria
 * per si sola una sobreescriptura vella). `location` rep, a més, el tracte
 * que explica `withoutAreaServedIds`.
 */
export function prepareLocalizedSiteSettings(
  current: Record<string, unknown>,
  localized: SeedBuild<string>['siteSettings'],
): Record<string, unknown> {
  const merged = mergeLocalized(current, localized) as Record<string, unknown>
  merged.ui = seedUiOverrides(localized.ui ?? undefined)
  if ('location' in merged) merged.location = withoutAreaServedIds(merged.location)
  return merged
}
