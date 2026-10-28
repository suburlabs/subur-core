import config from '../fixtures/app/src/payload.config.js'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import { up } from '../../src/migrations/20261018_120000_next_cache.js'

describe('taules de la memòria cau (spec §26.3)', () => {
  it('existeixen amb les columnes i l’índex esperats', async () => {
    const payload = await getPayload({ config })
    const db = payload.db.drizzle
    const cols = await db.execute(sql`select column_name, data_type, is_nullable from information_schema.columns where table_name = 'next_cache' order by ordinal_position`)
    expect(cols.rows.map((r) => `${r.column_name}:${r.data_type}:${r.is_nullable}`)).toEqual([
      'key:text:NO', 'build:text:NO', 'kind:text:NO', 'payload:text:NO', 'tags:ARRAY:NO', 'revalidate:integer:YES',
      'started_at:timestamp with time zone:NO', 'last_modified:timestamp with time zone:NO',
    ])
    const tags = await db.execute(sql`select column_name from information_schema.columns where table_name = 'next_cache_tags' order by ordinal_position`)
    expect(tags.rows.map((r) => r.column_name)).toEqual(['tag', 'invalidated_at'])
    const idx = await db.execute(sql`select indexdef from pg_indexes where tablename = 'next_cache' and indexname = 'next_cache_tags_idx'`)
    expect(String(idx.rows[0]?.indexdef)).toMatch(/USING gin \(tags\)/)
  })

  it('la migració és idempotent i buida la cau (restaurar una còpia d’abans de K2)', async () => {
    const payload = await getPayload({ config })
    const db = payload.db.drizzle
    await db.execute(sql`insert into public.next_cache (key, build, kind, payload, started_at, last_modified)
      values ('/es#idempotent', 'b-old', 'APP_PAGE', '{}', now(), now())
      on conflict (key) do nothing`)
    const before = await db.execute(sql`select count(*)::int as n from public.next_cache`)
    expect(before.rows[0]?.n).toBeGreaterThan(0)
    await expect(up({ db } as never)).resolves.toBeUndefined()
    const rows = await db.execute(sql`select count(*)::int as n from public.next_cache`)
    expect(rows.rows[0]?.n).toBe(0)
  })
})
