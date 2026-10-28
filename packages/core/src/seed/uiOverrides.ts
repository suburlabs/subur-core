import { type UiKey, uiKeys } from '../i18n/uiDefaults.js'

type Overrides = Partial<Record<UiKey, null | string | undefined>>

/**
 * Cada clau de `uiKeys`, amb el text que el client sobreescriu o `null` si
 * no n'hi ha cap. El seed l'escriu sencer a cada idioma (Tasca 6, ronda de
 * revisió): `updateGlobal` fa una fusió parcial amb el document existent, i
 * si no s'escrivís `ui` explícitament, un valor d'una sembra anterior hi
 * quedaria penjat per sempre i tornar a sembrar no seria reproduïble.
 */
export function seedUiOverrides(overrides?: Overrides): Record<UiKey, null | string> {
  return Object.fromEntries(uiKeys.map((key) => [key, overrides?.[key] ?? null])) as Record<
    UiKey,
    null | string
  >
}
