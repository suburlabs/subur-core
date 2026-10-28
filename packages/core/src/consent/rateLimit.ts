/**
 * Límit de peticions i de mida a `POST /api/c15t/subjects` (spec §22.6).
 * Només aquesta ruta i aquest mètode compten: la resta del backend de
 * c15t (`/api/c15t/init`, `GET`, etc.) no hi passa. En memòria del procés
 * (una sola rèplica, sense estat compartit entre contenidors): finestra fixa
 * per IP amb neteja d'entrades caducades i un sostre absolut d'entrades
 * perquè el mapa no creixi sense límit quan hi ha molts clients reals
 * diferents. La suplantació d'IP ja la tanca Caddy (reescriu
 * `X-Forwarded-For` amb la IP real i descarta la que enviï el visitant,
 * `backend.ts`): aquest sostre és només un límit de memòria, no una defensa
 * contra IP falses.
 */

export const SUBJECTS_MAX = 20
export const SUBJECTS_WINDOW_MS = 600_000
export const MAX_ENTRIES = 10_000
export const MAX_BODY_BYTES = 16_384

type Entry = { count: number; resetAt: number }

type HitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Finestra fixa per clau: comptador que es reinicia sencer quan `now` supera
 * `resetAt`. Quan el mapa arriba a `maxEntries`, primer s'esborren les
 * entrades ja caducades i, si encara cal espai, es descarta la més antiga
 * (l'ordre d'inserció d'un `Map` de JavaScript, verificat a l'especificació
 * del llenguatge: `Map.prototype.keys()` itera en aquest ordre).
 */
export function createRateLimiter(opts: {
  max: number
  maxEntries: number
  now?: () => number
  windowMs: number
}) {
  const { max, maxEntries, windowMs } = opts
  const now = opts.now ?? (() => Date.now())
  const entries = new Map<string, Entry>()

  function evictIfFull() {
    if (entries.size < maxEntries) return
    const t = now()
    for (const [key, entry] of entries) {
      if (entry.resetAt <= t) entries.delete(key)
    }
    if (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value
      if (oldestKey !== undefined) entries.delete(oldestKey)
    }
  }

  return {
    hit(key: string): HitResult {
      const t = now()
      const existing = entries.get(key)
      if (!existing || existing.resetAt <= t) {
        evictIfFull()
        entries.set(key, { count: 1, resetAt: t + windowMs })
        return { allowed: true }
      }
      if (existing.count >= max) {
        return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - t) / 1000) }
      }
      existing.count += 1
      return { allowed: true }
    },
    size() {
      return entries.size
    },
  }
}

const limiter = createRateLimiter({ max: SUBJECTS_MAX, maxEntries: MAX_ENTRIES, windowMs: SUBJECTS_WINDOW_MS })

/**
 * Mateixa font que `ipAddress.ipAddressHeaders` a `backend.ts`: només
 * `X-Forwarded-For`, mai `X-Client-IP` (Caddy reescriu la primera, però deixa
 * passar qualsevol valor que el visitant enviï a la segona). Pot portar una
 * llista (`client, proxy1, proxy2`); el primer valor és el del client.
 */
export function clientIp(request: Request): string {
  const header = request.headers.get('x-forwarded-for')
  if (!header) return 'unknown'
  const first = header.split(',')[0]?.trim()
  return first || 'unknown'
}

function jsonError(status: number, error: string, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ error }), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}

function isSubjectsPost(request: Request): boolean {
  if (request.method !== 'POST') return false
  const { pathname } = new URL(request.url)
  return pathname.endsWith('/api/c15t/subjects')
}

/**
 * Llegeix el cos xoc a xoc, comptant bytes a mesura que arriben, i talla
 * (`reader.cancel()`) en el moment que se supera `MAX_BODY_BYTES`: mai manté
 * en memòria més que el que ja s'ha llegit fins llavors, a diferència de
 * `request.clone().arrayBuffer()`, que primer rep tot el cos (encara que
 * vingui xocat, sense `Content-Length`, com una petició amb
 * `Transfer-Encoding: chunked`) i només després en mira la mida — sense cap
 * cota real de memòria en aquell cas.
 *
 * Quan el cos cap dins el límit, torna els bytes llegits perquè
 * `withConsentLimits` reconstrueixi la petició (el `ReadableStream` original
 * ja s'ha consumit en llegir-lo directament, sense passar per `clone()`).
 */
async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<{ bytes: Uint8Array; ok: true } | { ok: false }> {
  if (!body) return { bytes: new Uint8Array(0), ok: true }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return { ok: false }
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, ok: true }
}

/**
 * Embolcalla el gestor del backend de c15t: només actua a `POST
 * /api/c15t/subjects` (la resta de mètodes i camins passen sense tocar-los).
 * Mida abans que ritme: un cos massa gran no gasta cap petició del límit.
 */
export function withConsentLimits(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (!isSubjectsPost(request)) return handler(request)

    const contentLength = request.headers.get('content-length')
    if (contentLength !== null) {
      // Camí ràpid: `Content-Length` ja diu la mida declarada, sense llegir
      // res; la petició original arriba intacta al backend de c15t.
      if (Number(contentLength) > MAX_BODY_BYTES) {
        return jsonError(413, 'payload_too_large')
      }
    } else {
      // Sense `Content-Length` (p. ex. `Transfer-Encoding: chunked`): l'única
      // manera de no acumular un cos arbitràriament gran és llegir-lo
      // directament i tallar de seguida que se superi el límit.
      const result = await readBoundedBody(request.body)
      if (!result.ok) {
        return jsonError(413, 'payload_too_large')
      }
      // El `ReadableStream` original ja està consumit: cal una petició nova
      // amb els mateixos mètode, capçaleres i URL, i el cos ja llegit.
      // Verificat al runtime instal·lat (Node 25 / undici): el constructor
      // de `Request` accepta un `Request` ja «disturbed» com a `input`
      // sempre que `init.body` el sobreescrigui explícitament — només llança
      // si `init` no porta `body` i s'intenta reutilitzar el de `input`.
      request = new Request(request, { body: result.bytes })
    }

    const ip = clientIp(request)
    const result = limiter.hit(ip)
    if (!result.allowed) {
      return jsonError(429, 'rate_limited', { 'retry-after': String(result.retryAfterSeconds) })
    }

    return handler(request)
  }
}
