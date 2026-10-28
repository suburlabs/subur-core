type Input = {
  acceptLanguage?: string | null
  cookie?: string | null
}

type Options<L extends string> = {
  defaultLocale: L
  locales: readonly L[]
}

const parseAcceptLanguage = (header: string): string[] =>
  header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((param) => param.trim().startsWith('q='))
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1
      return { index, language: tag.toLowerCase().split('-')[0], q: Number.isNaN(q) ? 0 : q }
    })
    .filter(({ language, q }) => language && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ language }) => language)

export function resolveLocale<L extends string>(input: Input, options: Options<L>): L {
  const { defaultLocale, locales } = options
  const isSupported = (value: string): value is L => (locales as readonly string[]).includes(value)

  if (input.cookie && isSupported(input.cookie)) return input.cookie

  if (input.acceptLanguage) {
    const match = parseAcceptLanguage(input.acceptLanguage).find(isSupported)
    if (match) return match
  }

  return defaultLocale
}
