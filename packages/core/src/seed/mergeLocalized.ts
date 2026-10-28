const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function mergeLocalized<T>(base: T, localized: unknown): T {
  if (localized === undefined) return base

  if (Array.isArray(base)) {
    const items = Array.isArray(localized) ? localized : []
    return base.map((item, index) => mergeLocalized(item, items[index])) as T
  }

  if (isPlainObject(base)) {
    if (isPlainObject(localized) && 'root' in localized) return localized as T
    if (!isPlainObject(localized)) return base

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(base)) {
      result[key] = key === 'id' ? value : mergeLocalized(value, localized[key])
    }
    return result as T
  }

  return localized as T
}
