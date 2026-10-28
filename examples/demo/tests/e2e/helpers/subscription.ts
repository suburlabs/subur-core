import { type APIRequestContext, expect, type Page } from '@playwright/test'

import type { TestUser } from '../../helpers/seedUser'

/** Superadministrador propi dels e2e que canvien la subscripció (no comparteix adreça amb cap altre fitxer). */
export const planSuperUser: TestUser = { email: 'plan-super@subur.dev', password: 'test', role: 'superadmin' }

type SubscriptionData = { maxLanguages?: number; modules?: string[]; plan?: 'business' | 'starter' }

/**
 * La subscripció que sembra el seed des de `.subur/` (els valors del
 * `.subur/` de la demo): l'estat al qual tornen els `afterAll`.
 */
export const contractSubscription = {
  maxLanguages: 3,
  modules: ['blog', 'advanced-seo', 'ai-visibility', 'priority-support', 'internacional'],
  plan: 'business',
} satisfies SubscriptionData

/**
 * Canvia la subscripció pel servidor (REST amb sessió de superadmin), no per
 * l'API local del procés de proves: només així corre el hook que caduca
 * `global_subscription` al servidor (mateix patró que `activeLocales.e2e.spec.ts`).
 */
export async function setSubscription(request: APIRequestContext, data: SubscriptionData, user: TestUser = planSuperUser) {
  const login = await request.post('/api/users/login', { data: { email: user.email, password: user.password } })
  expect(login.ok()).toBe(true)
  const update = await request.post('/api/globals/subscription', { data })
  expect(update.ok()).toBe(true)
}

/** Tots els `@type` del graf JSON-LD per pàgina (§22.3), de tots els `<script>` de la pàgina. */
export async function pageGraphTypes(page: Page): Promise<string[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
  return scripts.flatMap((raw) => (JSON.parse(raw)['@graph'] as Array<{ '@type': string }>).map((n) => n['@type']))
}
