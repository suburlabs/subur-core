// @vitest-environment node
import config from '../fixtures/app/src/payload.config.js'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { flushSiteCacheAfterSeed } from '../../src/seed/exports.js'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('el seed buida la memòria cau persistent', () => {
  it('esborra next_cache i deixa la làpida global, sense tocar les altres làpides', async () => {
    const db = payload.db.drizzle
    await db.execute(sql`delete from next_cache_tags where tag in ('*', 'seed-keep')`)
    await db.execute(sql`insert into next_cache_tags (tag, invalidated_at) values ('seed-keep', now())`)
    await db.execute(sql`delete from next_cache`)
    await db.execute(sql`insert into next_cache (key, build, kind, payload, started_at, last_modified) values ('seed-dummy', 'b', 'FETCH', '{}', now(), now())`)

    await flushSiteCacheAfterSeed(payload)

    const rows = (await db.execute(sql`select count(*)::int as n from next_cache`)).rows as { n: number }[]
    expect(rows[0].n).toBe(0)
    const tags = (await db.execute(sql`select tag from next_cache_tags where tag in ('*', 'seed-keep') order by tag`)).rows as { tag: string }[]
    expect(tags.map((t) => t.tag)).toEqual(['*', 'seed-keep'])
    await db.execute(sql`delete from next_cache_tags where tag = 'seed-keep'`)
  })
})
