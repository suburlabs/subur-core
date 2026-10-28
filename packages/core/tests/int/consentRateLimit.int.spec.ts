import { describe, expect, it, vi } from 'vitest'

import { createRateLimiter, MAX_BODY_BYTES, withConsentLimits } from '../../src/consent/rateLimit.js'

const post = (ip: string, body = '{}', path = '/api/c15t/subjects') =>
  new Request(`http://localhost:3000${path}`, {
    body,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    method: 'POST',
  })

describe('createRateLimiter', () => {
  it('deixa passar 20 per finestra i la 21a porta Retry-After', () => {
    let t = 0
    const limiter = createRateLimiter({ max: 20, maxEntries: 10_000, now: () => t, windowMs: 600_000 })
    for (let i = 0; i < 20; i++) expect(limiter.hit('1.2.3.4').allowed).toBe(true)
    const denied = limiter.hit('1.2.3.4')
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 600 })
    t = 600_000
    expect(limiter.hit('1.2.3.4').allowed).toBe(true)
  })

  it('cada IP té el seu comptador i el sostre d’entrades no creix sense límit', () => {
    const limiter = createRateLimiter({ max: 1, maxEntries: 3, now: () => 0, windowMs: 1000 })
    for (const ip of ['a', 'b', 'c', 'd', 'e']) expect(limiter.hit(ip).allowed).toBe(true)
    expect(limiter.size()).toBeLessThanOrEqual(3)
  })
})

describe('withConsentLimits', () => {
  it('429 a la 21a POST /subjects de la mateixa IP; les altres rutes no compten', async () => {
    const inner = vi.fn(async () => new Response('ok'))
    const handler = withConsentLimits(inner)
    for (let i = 0; i < 20; i++) expect((await handler(post('9.9.9.9'))).status).toBe(200)
    const limited = await handler(post('9.9.9.9'))
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await handler(post('9.9.9.9', '{}', '/api/c15t/init'))).status).toBe(200)
    expect((await handler(post('8.8.8.8'))).status).toBe(200)
  })

  it('413 si el cos supera 16 KB, sense cridar el backend', async () => {
    const inner = vi.fn(async () => new Response('ok'))
    const response = await withConsentLimits(inner)(post('7.7.7.7', 'x'.repeat(MAX_BODY_BYTES + 1)))
    expect(response.status).toBe(413)
    expect(inner).not.toHaveBeenCalled()
  })

  // Un cos xocat (`Transfer-Encoding: chunked`, sense `Content-Length`) no es
  // pot mesurar per capçalera: cal llegir-lo directament i tallar de seguida
  // que se superi el límit, sense acumular-lo sencer en memòria.
  const chunkedPost = (ip: string, totalBytes: number, onPull?: (pulled: number) => void) => {
    const chunkSize = 64 * 1024
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= totalBytes) {
          controller.close()
          return
        }
        const size = Math.min(chunkSize, totalBytes - pulled)
        controller.enqueue(new Uint8Array(size).fill(120))
        pulled += size
        onPull?.(pulled)
      },
    })
    return new Request('http://localhost:3000/api/c15t/subjects', {
      body: stream,
      duplex: 'half',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      method: 'POST',
    } as RequestInit)
  }

  it('413 amb un cos xocat (sense Content-Length) que supera el límit, sense llegir-lo sencer ni cridar el backend', async () => {
    const inner = vi.fn(async () => new Response('ok'))
    const totalBytes = 1_048_576 // 1 MB, molt per sobre de MAX_BODY_BYTES
    let pulled = 0
    const request = chunkedPost('6.6.6.6', totalBytes, (p) => {
      pulled = p
    })

    const response = await withConsentLimits(inner)(request)

    expect(response.status).toBe(413)
    expect(inner).not.toHaveBeenCalled()
    expect(pulled).toBeLessThan(totalBytes)
  })

  it('deixa passar un cos xocat (sense Content-Length) dins del límit, intacte, cap al backend', async () => {
    const received: { bytes: number; text: string } = { bytes: 0, text: '' }
    const inner = vi.fn(async (request: Request) => {
      const text = await request.text()
      received.bytes = new TextEncoder().encode(text).byteLength
      received.text = text
      return new Response('ok')
    })
    const body = JSON.stringify({ subjectId: 'sub_test' })
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    })
    const request = new Request('http://localhost:3000/api/c15t/subjects', {
      body: stream,
      duplex: 'half',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '5.5.5.5' },
      method: 'POST',
    } as RequestInit)

    const response = await withConsentLimits(inner)(request)

    expect(response.status).toBe(200)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(received.text).toBe(body)
  })
})
