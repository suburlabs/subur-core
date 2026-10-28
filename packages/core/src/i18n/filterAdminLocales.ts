import type { PayloadRequest } from 'payload'

type AdminLocale = { code: string }

/** Selector d'idioma del panell: Subur veu el catàleg; el client, el que té contractat. */
export async function filterAdminLocales<T extends AdminLocale>({
  locales,
  req,
}: {
  locales: T[]
  req: PayloadRequest
}): Promise<T[]> {
  if (req.user?.role === 'superadmin') return locales

  const subscription = await req.payload.findGlobal({ depth: 0, req, slug: 'subscription' })
  const active = new Set<string>(subscription.activeLocales ?? [])

  return locales.filter(({ code }) => active.has(code))
}
