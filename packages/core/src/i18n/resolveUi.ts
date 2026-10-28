import type { Locale } from './config.js'
import { type UiKey, uiDefaults, uiKeys } from './uiDefaults.js'

export type ResolvedUi = Record<UiKey, string>

type Overrides = Partial<Record<UiKey, null | string>> | null | undefined

/** El text del client en aquest idioma o, si l'ha deixat buit, el del nucli en aquest idioma. */
export function resolveUi(overrides: Overrides, locale: Locale): ResolvedUi {
  return Object.fromEntries(
    uiKeys.map((key) => [key, overrides?.[key]?.trim() || uiDefaults[key].text[locale]]),
  ) as ResolvedUi
}
