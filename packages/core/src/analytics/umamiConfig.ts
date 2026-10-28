export type Env = Record<string, string | undefined>

const keys = ['NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'NEXT_PUBLIC_UMAMI_SCRIPT_URL'] as const
const read = (env: Env, key: (typeof keys)[number]) => env[key]?.trim() ?? ''

/**
 * Umami (spec §21.3): totes dues variables o cap. Sense cap, la web no
 * carrega cap analítica (desenvolupament); amb només una, error en arrencar.
 * Les variables són `NEXT_PUBLIC_*`: es couen al build de la imatge.
 */
export const umamiConfig = (env: Env): { scriptUrl: string; websiteId: string } | null => {
  const present = keys.filter((k) => read(env, k) !== '')
  if (present.length === 0) return null
  const missing = keys.filter((k) => read(env, k) === '')
  if (missing.length > 0) throw new Error(`Umami: faltan variables de entorno: ${missing.join(', ')}`)
  const scriptUrl = read(env, 'NEXT_PUBLIC_UMAMI_SCRIPT_URL')
  // Validat aquí (i no a `umamiScripts`, on `new URL` es cridava a cada
  // render de `ConsentManagerProvider`): una variable mal formada (sense
  // esquema, p. ex.) feia que TOTA la web retornés 500 mentre `/api/health`
  // seguia responent 200. Validar-ho aquí fa que el guard R4 de
  // `src/plugins/index.ts` (`umamiConfig(process.env)` cridat a l'arrencada)
  // converteixi l'error en una fallada de build/arrencada, no un 500 per
  // petició.
  let parsed: URL
  try {
    parsed = new URL(scriptUrl)
  } catch {
    throw new Error('Umami: NEXT_PUBLIC_UMAMI_SCRIPT_URL no es una URL válida')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Umami: NEXT_PUBLIC_UMAMI_SCRIPT_URL no es una URL válida')
  }
  return { scriptUrl, websiteId: read(env, 'NEXT_PUBLIC_UMAMI_WEBSITE_ID') }
}
